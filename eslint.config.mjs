import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// `next lint` doesn't exist in Next.js 16 — it dropped the built-in CLI
// wrapper, so `npm run lint` was silently a no-op (it printed Next's generic
// --help and reported nothing). This restores it via flat-config ESLint,
// deliberately at the same bar the project actually ran at: core-web-vitals
// only (react-hooks correctness, next/image, a11y, no-html-link-for-pages).
//
// eslint-config-next/typescript (no-explicit-any and friends) was tried and
// reverted — this codebase uses `any` deliberately in dozens of places
// (dynamic Prisma `where` clauses, withAuth handler signatures, catch
// blocks), matching CLAUDE.md's "match existing style" guidance. Turning
// that ruleset on wouldn't be restoring a check this project ever passed —
// it would be imposing a new, stricter bar 450+ violations away from green,
// unrelated to what `next lint` used to actually gate.
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '.audit-build/**',
      '.parser-build/**',
      'uploads/**',
      'actions-runner/**',
      'prisma/migrations/**',
      'uid.tmp.js',
      // Plain Node/CommonJS ops scripts — seeders, migrations, backfills,
      // the audit harness. Never part of what `next lint` checked either.
      'scripts/**',
      'prisma/**/*.js',
    ],
  },
  ...nextCoreWebVitals,
  {
    // react-hooks/set-state-in-effect and react-hooks/immutability are recent
    // additions to eslint-plugin-react-hooks, written for React Compiler
    // adoption — this project doesn't use the compiler. Run as errors, they
    // flag ~65 instances of ordinary, correct React (deriving state from a
    // prop in an effect; assigning a callback ref's `.current`) across
    // components that predate today and were never broken. Kept as warnings
    // rather than off, so the signal isn't thrown away — just not blocking.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
];

export default config;
