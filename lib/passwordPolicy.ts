// Single source of truth for what counts as an acceptable password, shared by
// the self-service reset, the self-service change, and the admin-set path — so
// the three can't drift into enforcing different rules.
//
// The split below is deliberate. An earlier version *rejected* anything that
// contained the account's own name or email local part, which meant an admin
// on admin@… could not use a password containing "admin" — including a
// perfectly ordinary one like "adminA123". Rules that refuse a reasonable
// choice without explaining themselves get worked around, not obeyed: people
// fall back to whatever the checker will accept, which is usually worse than
// what they first picked. So only length is enforced; everything else is
// surfaced as advice the user can see and overrule.

export const PASSWORD_MIN_LENGTH = 8;

// Kept small on purpose. A real breach corpus belongs behind a service; this
// just names the handful of passwords that lead every credential-stuffing
// list, and now warns rather than blocks.
const OBVIOUS = new Set([
  'password', 'password1', 'password123', 'passw0rd', '12345678', '123456789',
  '1234567890', 'qwerty123', 'qwertyuiop', 'welcome1', 'welcome123', 'admin123',
  'administrator', 'letmein1', 'iloveyou', 'abc12345', 'a1b2c3d4', 'changeme',
  'trustno1', 'sunshine', 'football', 'baseball', 'superman', 'starwars',
  'eorbitor', 'eorbitor123', 'pulse123', 'crm12345',
]);

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

export interface PasswordContext {
  email?: string;
  firstName?: string;
}

/**
 * The only rules that block a password. Both are structural rather than
 * judgements about strength: below the minimum there is nothing to protect,
 * and above the maximum we are just burning CPU on a hash bcrypt won't read.
 */
export function validatePassword(password: string, _context?: PasswordContext): PasswordCheck {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > 200) {
    // bcrypt only reads the first 72 bytes anyway; the cap stops an enormous
    // input being used to burn CPU on hashing.
    return { ok: false, message: 'Password is too long.' };
  }
  return { ok: true };
}

/**
 * Advice, never enforcement. Returns the single most useful caution to show
 * beside the field — one clear sentence is read, a list of five is not.
 * The password is accepted either way.
 */
export function passwordWarning(password: string, context?: PasswordContext): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) return null;

  const lower = password.toLowerCase();

  if (OBVIOUS.has(lower)) {
    return 'This is one of the most commonly used passwords — it is likely to be guessed.';
  }
  if (/^(.)\1+$/.test(password)) {
    return 'This is a single repeated character — consider something less predictable.';
  }
  if (/^\d+$/.test(password)) {
    return 'Digits only — adding letters would make this much harder to guess.';
  }

  const localPart = context?.email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    return 'This contains your login name, which anyone who knows you can guess.';
  }
  const first = context?.firstName?.toLowerCase();
  if (first && first.length >= 3 && lower.includes(first)) {
    return 'This contains your first name, which anyone who knows you can guess.';
  }

  if (password.length < 12 && /^[a-z]+$/.test(password)) {
    return 'Short and all lowercase — a longer phrase would be considerably stronger.';
  }

  return null;
}
