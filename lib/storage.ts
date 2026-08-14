import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Base directory for persisted uploads. FILE_UPLOAD_DIR points at a prod path
// (e.g. /opt/eorbitor-pulse/uploads) that may not be writable in dev, so fall
// back to <cwd>/uploads when the configured dir can't be created.
function resolveUploadRoot(): string {
  const configured = process.env.FILE_UPLOAD_DIR;
  const candidates = [configured, path.join(process.cwd(), 'uploads')].filter(Boolean) as string[];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      // Confirm writability
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // try next candidate
    }
  }
  // Last resort — let the caller's write throw a clear error
  return path.join(process.cwd(), 'uploads');
}

const UPLOAD_ROOT = resolveUploadRoot();

const ALLOWED_EXTENSIONS = (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,zip')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800'); // 50MB default

export interface StoredFile {
  id: string;            // unique file id (used in download URL)
  filename: string;      // original filename (for display/download)
  contentType: string;
  size: number;          // bytes
  storagePath: string;   // path relative to UPLOAD_ROOT
  uploadedAt: string;    // ISO
}

export interface IncomingFile {
  filename: string;
  contentType?: string;
  dataBase64: string;
}

/**
 * Persist base64-encoded uploads to disk under a per-entity subfolder.
 * Returns metadata to store in the DB (JSON). Throws on validation failure.
 */
/**
 * Leading bytes that identify a file's real format.
 *
 * The allow-list above checks the *name*, which the uploader chooses freely —
 * renaming shell.php to invoice.pdf defeated it entirely. Comparing the actual
 * header means the extension has to be telling the truth.
 *
 * Several formats share a container, so the mapping is many-to-one: every
 * modern Office document is a ZIP, and the legacy ones are all OLE2.
 */
const ZIP = [
  [0x50, 0x4b, 0x03, 0x04], // normal archive
  [0x50, 0x4b, 0x05, 0x06], // empty archive
  [0x50, 0x4b, 0x07, 0x08], // spanned archive
];
const OLE2 = [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]];

const MAGIC: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],                 // %PDF
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  gif: [[0x47, 0x49, 0x46, 0x38]],                 // GIF8
  zip: ZIP,
  docx: ZIP,
  xlsx: ZIP,
  pptx: ZIP,
  doc: OLE2,
  xls: OLE2,
  ppt: OLE2,
};

function looksLike(buffer: Buffer, ext: string): boolean {
  const signatures = MAGIC[ext];
  // No signature on record (a plain-text format, say) — the extension
  // allow-list is all we can reasonably enforce.
  if (!signatures) return true;
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
}

export function saveBase64Files(
  entityFolder: string,      // e.g. `leads/<leadId>`
  files: IncomingFile[],
): StoredFile[] {
  const dir = path.join(UPLOAD_ROOT, entityFolder);
  fs.mkdirSync(dir, { recursive: true });

  const stored: StoredFile[] = [];
  for (const f of files) {
    if (!f?.dataBase64 || !f?.filename) continue;

    // `path.extname` returns '' for a name with no dot ("payload") and for a
    // dotfile (".htaccess"). The old guard was `if (ext && ...)`, so both of
    // those skipped the allow-list entirely — the one shape of filename an
    // attacker controls completely. An extension is now required, and must be
    // on the list.
    const ext = path.extname(f.filename).slice(1).toLowerCase();
    if (ALLOWED_EXTENSIONS.length && !ALLOWED_EXTENSIONS.includes(ext)) {
      throw Object.assign(
        new Error(
          ext
            ? `File type ".${ext}" is not allowed`
            : `"${f.filename}" has no file extension, so its type cannot be checked`
        ),
        { status: 400 }
      );
    }

    const buffer = Buffer.from(f.dataBase64, 'base64');

    // The extension said what this is; the bytes have to agree. Without this a
    // renamed executable or script was stored and later served back under a
    // trusted-looking name.
    if (!looksLike(buffer, ext)) {
      throw Object.assign(
        new Error(`"${f.filename}" is not a valid .${ext} file — its contents do not match its extension.`),
        { status: 400 },
      );
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw Object.assign(
        new Error(`File "${f.filename}" exceeds the ${Math.round(MAX_FILE_SIZE / 1048576)}MB limit`),
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const safeName = `${id}${ext ? '.' + ext : ''}`;
    const relPath = path.join(entityFolder, safeName);
    fs.writeFileSync(path.join(UPLOAD_ROOT, relPath), buffer);

    stored.push({
      id,
      filename: f.filename,
      contentType: f.contentType || 'application/octet-stream',
      size: buffer.length,
      storagePath: relPath,
      uploadedAt: new Date().toISOString(),
    });
  }
  return stored;
}

/** Read a stored file back off disk. Returns null if missing. */
export function readStoredFile(storagePath: string): Buffer | null {
  const full = path.join(UPLOAD_ROOT, storagePath);
  // Prevent path traversal outside the upload root
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) return null;
  if (!fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved);
}
