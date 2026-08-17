import { Prisma } from '@prisma/client';

/**
 * Translate a Prisma exception into an HTTP status and a message safe to show
 * the caller.
 *
 * Why this exists as a backstop rather than only validating at the edges: a
 * Prisma failure is an *exception*, so any field anyone forgets to check turns
 * a bad value into a 500. That has already happened repeatedly here — invalid
 * enum filters, unparseable dates, NaN money, foreign keys pointing at nothing
 * — and each was fixed one route at a time while the next unguarded field went
 * on doing it. Validating inputs gives a precise message; this guarantees the
 * floor, so a missed field is a 400 with a sentence rather than a 500 with none.
 *
 * Prisma's own message must never be returned verbatim. A validation error
 * carries the full query, an excerpt of the compiled source and the absolute
 * path of the project on the server — which is exactly the leak `withAuth`
 * already stopped for generic 500s.
 */

export interface TranslatedPrismaError {
  status: number;
  message: string;
}

/** Turn `['gstNumber']` into "GST number"-ish prose for a message. */
function fieldLabel(target: unknown): string | null {
  const fields = Array.isArray(target)
    ? target
    : typeof target === 'string'
    ? [target]
    : [];
  if (fields.length === 0) return null;
  const pretty = fields
    .map((f) =>
      String(f)
        // strip Prisma's index naming, e.g. "Lead_leadNumber_key"
        .replace(/^.*?_(.+)_key$/, '$1')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
    )
    .join(' and ');
  return pretty || null;
}

/**
 * The one genuinely useful sentence inside a PrismaClientValidationError.
 *
 * Prisma states the offending argument and the type it wanted — "Invalid value
 * for argument `source`. Expected LeadSource." — on its own line, with no path
 * or source excerpt in it. Everything around it is internal.
 */
function argumentComplaint(message: string): string | null {
  const invalidValue = message.match(/Invalid value for argument `([^`]+)`\.\s*(Expected [^.\n]+\.)/);
  if (invalidValue) return `Invalid value for "${invalidValue[1]}". ${invalidValue[2]}`;

  const badDate = message.match(/Provided Date object is invalid/);
  if (badDate) return 'A date in this request could not be understood.';

  const unknownArg = message.match(/Unknown argument `([^`]+)`/);
  if (unknownArg) return `"${unknownArg[1]}" is not a field that can be set here.`;

  const missingArg = message.match(/Argument `([^`]+)` is missing/);
  if (missingArg) return `"${missingArg[1]}" is required.`;

  return null;
}

/**
 * Classify an error. Returns null when it is not a Prisma error, so the caller
 * can fall through to its existing handling.
 */
export function translatePrismaError(err: unknown): TranslatedPrismaError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2000':
        return {
          status: 400,
          message: `That value is too long for the "${fieldLabel(err.meta?.column_name) ?? 'field'}" field.`,
        };
      case 'P2002': {
        const label = fieldLabel(err.meta?.target);
        return {
          status: 409,
          message: label
            ? `A record with this ${label} already exists.`
            : 'A record with these details already exists.',
        };
      }
      case 'P2003':
        return {
          status: 400,
          message: 'This refers to a record that no longer exists. Refresh the page and try again.',
        };
      case 'P2011':
      case 'P2012':
        return { status: 400, message: 'A required field is missing from this request.' };
      case 'P2021':
      case 'P2022':
        // The generated client expects a table or column the database does not
        // have — the deploy ran without `prisma db push`. This is the operator's
        // problem, not the caller's, so it must not be dressed up as a 400: a
        // user retrying or editing their input can never fix it.
        return {
          status: 503,
          message:
            'The server is mid-update and this feature is briefly unavailable. Please tell your administrator if it persists.',
        };
      case 'P2014':
        return {
          status: 400,
          message: 'That change would break a link to another record.',
        };
      case 'P2025':
        return {
          status: 404,
          message:
            (typeof err.meta?.cause === 'string' && err.meta.cause) ||
            'That record no longer exists.',
        };
      default:
        // An unmapped known error is still a client-visible failure rather than
        // a fault, but we have nothing specific to say about it.
        return { status: 400, message: 'That request could not be completed.' };
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      message: argumentComplaint(err.message) ?? 'Some values in this request were not valid.',
    };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    // The database is unreachable — genuinely a server-side condition.
    return { status: 503, message: 'The database is unavailable. Please try again shortly.' };
  }

  return null;
}
