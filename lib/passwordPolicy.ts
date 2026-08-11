// Single source of truth for what counts as an acceptable password, shared by
// the self-service reset, the self-service change, and the admin-set path — so
// the three can't drift into enforcing different rules.

export const PASSWORD_MIN_LENGTH = 8;

// Deliberately tiny. A full breach corpus belongs behind a real service; this
// only catches the handful of choices that show up first in any credential
// stuffing attempt, which is most of the value for almost none of the weight.
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

export function validatePassword(password: string, context?: { email?: string; firstName?: string }): PasswordCheck {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > 200) {
    // bcrypt only reads the first 72 bytes anyway; the cap is here so an
    // enormous input can't be used to burn CPU on hashing.
    return { ok: false, message: 'Password is too long.' };
  }

  const lower = password.toLowerCase();
  if (OBVIOUS.has(lower)) {
    return { ok: false, message: 'That password is too common. Please choose something less predictable.' };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, message: 'Password cannot be a single repeated character.' };
  }

  // A password built from the account's own identifiers is trivially guessable
  // by anyone who knows who the user is — which, internally, is everyone.
  const localPart = context?.email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    return { ok: false, message: 'Password must not contain your email address.' };
  }
  const first = context?.firstName?.toLowerCase();
  if (first && first.length >= 3 && lower.includes(first)) {
    return { ok: false, message: 'Password must not contain your name.' };
  }

  return { ok: true };
}
