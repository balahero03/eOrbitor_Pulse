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
export function saveBase64Files(
  entityFolder: string,      // e.g. `leads/<leadId>`
  files: IncomingFile[],
): StoredFile[] {
  const dir = path.join(UPLOAD_ROOT, entityFolder);
  fs.mkdirSync(dir, { recursive: true });

  const stored: StoredFile[] = [];
  for (const f of files) {
    if (!f?.dataBase64 || !f?.filename) continue;

    const ext = path.extname(f.filename).slice(1).toLowerCase();
    if (ext && ALLOWED_EXTENSIONS.length && !ALLOWED_EXTENSIONS.includes(ext)) {
      throw Object.assign(new Error(`File type ".${ext}" is not allowed`), { status: 400 });
    }

    const buffer = Buffer.from(f.dataBase64, 'base64');
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
