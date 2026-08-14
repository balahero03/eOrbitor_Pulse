import sanitize from 'sanitize-html';

/**
 * Sanitiser for rich-text fields that are later rendered with
 * `dangerouslySetInnerHTML`.
 *
 * Why this exists
 * ---------------
 * Task descriptions are authored in the Tiptap editor, stored as raw HTML, and
 * rendered back with `dangerouslySetInnerHTML` on the task detail page. Nothing
 * sat between those three steps, so a task description was an arbitrary HTML
 * injection point: an ON_FIELD_TEAM user could save
 * `<img src=x onerror="...">` and it executed in the browser of whoever opened
 * that task next — confirmed against a SUPER_ADMIN session. Because the JWT is
 * held in `localStorage`, script running in that session can read it outright,
 * so this was a path from the lowest-privilege role to full account takeover.
 *
 * Applied on **write**, in the API, rather than on render. Sanitising at the
 * render site would leave the payload sitting in the database and rely on every
 * future consumer — an export, a PDF, an email, a second UI — remembering to
 * sanitise too. Cleaning it at the boundary means the stored value is always
 * safe, whoever reads it later.
 *
 * The allow-list is deliberately scoped to what the editor can actually
 * produce (StarterKit + Underline + Link + TaskList), so legitimate formatting
 * survives untouched and anything else is dropped. Using the `sanitize-html`
 * library rather than a hand-written filter is a deliberate choice: HTML
 * sanitisation has a long tail of bypasses (mutation XSS, namespace confusion,
 * malformed-markup parsing differences) that a regex or a bespoke allow-list
 * reliably gets wrong.
 */

const RICH_TEXT_OPTIONS: sanitize.IOptions = {
  allowedTags: [
    // StarterKit block nodes
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
    // Marks
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'span',
    // Link extension
    'a',
    // TaskList / TaskItem render as a list with checkbox inputs
    'label', 'div', 'input',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    // Tiptap marks task lists with these data attributes; the CSS in
    // globals.css keys off them, so dropping them would break rendering.
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    div: ['data-type'],
    span: ['data-type'],
    input: ['type', 'checked', 'disabled'],
  },
  // Anything not http/https/mailto — most importantly `javascript:` — is
  // stripped, which closes the other half of the injection surface: a link
  // whose href is itself a script.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  // A link that opens in a new tab without `noopener` hands the opened page a
  // `window.opener` reference back to this app. Forced on every link rather
  // than trusted from the input.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    // Checkboxes in a rendered task list are display only — the real state
    // lives in `data-checked` on the <li>. Forcing `disabled` stops a reader
    // toggling something that will never be saved.
    input: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, disabled: 'disabled' },
    }),
  },
  // Drop the *contents* of these too, not just the tags — otherwise the text
  // inside a stripped <script> is re-emitted as visible page text.
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed'],
};

/**
 * Clean a rich-text HTML field for storage.
 *
 * Null/undefined pass through unchanged so callers can keep using
 * `field !== undefined` to mean "not being updated".
 */
export function sanitizeRichText<T extends string | null | undefined>(html: T): T {
  if (html === null || html === undefined) return html;
  if (typeof html !== 'string') return html;
  return sanitize(html, RICH_TEXT_OPTIONS) as T;
}
