# Deployment

Guidance for the production deployment of eOrbitor Pulse. Complements
[CLAUDE.md](CLAUDE.md) — that file covers the codebase; this one covers the
running server.

> ⚠️ `deployserverlog .md` in this repo is a raw terminal transcript kept for
> reference during initial setup. It contains a **plaintext GitHub PAT and DB
> password** — it is git-ignored and must never be committed. Prefer this
> file for anything you need to hand to someone else.

---

## 1. Production host

| | |
|---|---|
| Host | `eotplsrv005ubuntu` (Ubuntu 22.04.5 LTS), reachable at `100.118.120.15` over Tailscale |
| App path | `~/eOrbitor_pulse` (checked out under the `administrator` user — note lowercase `pulse`, unlike the GitHub repo name `eOrbitor_Pulse`) |
| Domain | `crm.eorbitor.co.in`, fronted by a Cloudflare Tunnel → `127.0.0.1:3000` |
| Other stacks on the same box | `asset-frontend` / `asset-backend` / `asset-db` (unrelated app, port 3500/5000) — this is a shared server, be careful with global Docker commands |

The repo is cloned via HTTPS with a GitHub PAT (not SSH key) since `git clone`
over plain HTTPS with a password fails on GitHub now.

---

## 2. Runtime shape

Two containers via `docker compose` (`docker-compose.yml` at repo root):

- **`eorbitor-db`** — `postgres:16`, named volume `pgdata`, **not** exposed to
  the host — only `eorbitor-app` can reach it on the compose network.
- **`eorbitor-app`** — built from `Dockerfile` (multi-stage: `deps` → `builder`
  → `runner`, Node 20 bookworm-slim), bound to `127.0.0.1:3000` only (the
  Cloudflare Tunnel is what makes it internet-reachable, not a public port).

`.env.local` is loaded via `env_file`, but `docker-compose.yml` **overrides**
`DATABASE_URL`, `NODE_ENV`, `PORT`, `HOSTNAME`, and `SEED` with its own
compose-time values regardless of what's in `.env.local` — the `DATABASE_URL`
in `.env.local` (pointing at `localhost:5432`) is only relevant if you ever
run the app outside Docker.

A separate `.env` file (not `.env.local`) holds `POSTGRES_PASSWORD` and
`SEED`, referenced by `docker-compose.yml`'s `${POSTGRES_PASSWORD}` /
`${SEED:-false}` interpolation.

There's also a native `postgresql.service` installed on the host from an
earlier setup attempt — it's not used by the app (compose points at the `db`
container instead) and can be ignored/left as-is.

---

## 3. Deploy / redeploy

```bash
cd ~/eOrbitor_pulse
git pull origin main
docker compose build app
docker compose up -d app
docker logs eorbitor-app --tail 60      # confirm it reaches "✓ Ready" and doesn't loop
```

`db` is left alone (`docker compose up -d app` targets only the app service)
since it's long-running and rarely needs a rebuild.

To confirm health after a deploy:

```bash
docker compose ps                        # both containers should show "Up", db "healthy"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login   # expect 200
```

### First-ever deploy on a fresh box

Set `SEED=true` in `.env` before the first `docker compose up -d`, then flip
it back to `false` and redeploy — it upserts the seed users from
`prisma/seed-users.js` once. Leaving it `true` is harmless (upsert, not
insert) but unnecessary noise on every restart.

---

## 4. What `entrypoint.sh` does on every container start

[`docker/entrypoint.sh`](docker/entrypoint.sh) runs on every `eorbitor-app`
boot, in order:

1. **`scripts/pre-push-fixes.js`** — Node/Prisma script that patches the live
   DB for changes `prisma db push` can't safely apply on its own against data
   that already exists (see §5). Idempotent — safe on every boot, no-ops once
   applied.
2. **`npx prisma db push --skip-generate --accept-data-loss`** — syncs
   `prisma/schema.prisma` to the DB. This project has no real migration
   history (the original `CREATE TABLE`s were never captured as migrations),
   so `db push` is the standing sync mechanism, not `prisma migrate deploy`.
3. Optional seed if `SEED=true`.
4. `npm run start`.

Because `db push` diffs the live schema against `schema.prisma` on *every*
boot, any future breaking schema change (enum value rename/removal, new
table whose columns depend on an altered enum, etc.) can hit the same class
of failure fixed below. Check §5 before making that kind of schema change.

---

## 5. Incident: 2026-07-20 — `eorbitor-app` crash loop

**Symptom:** `eorbitor-app` restarting every ~40s, `docker compose ps` showing
`Restarting (1) ... ago`.

**Root cause:** commit `a1534a0` ("Clasification of Roles: Backend team and
on_field_team") renamed the `UserRole` enum in `schema.prisma`
(`SALES_MANAGER` / `SALES_EXEC` / `SUPPORT` / `VIEWER` →
`BACKEND_TEAM` / `ON_FIELD_TEAM`) with no accompanying data migration. On the
next deploy, `prisma db push` tried to `ALTER TYPE` the enum and Postgres
refused — existing `User` rows still held the old enum values, which no
longer exist in the new type.

A second, distinct issue surfaced once the enum was patched: `db push` also
had to `CREATE TABLE` for three new models added in the same schema change
(`AccessPolicy`, `QuotationPolicy`, `AfterHoursAccessRequest`) — and
`AccessPolicy.restrictedRoles` is a `UserRole[]` column. Doing an `AlterEnum`
and a `CreateTable` referencing that enum in the same `db push` pass hit a
Prisma 5 schema-engine ordering bug (`P1014: the underlying table for model
AccessPolicy does not exist`), confirmed via a one-off interactive
`prisma db push` run outside the crash-looping container.

**Fix** ([`scripts/pre-push-fixes.js`](scripts/pre-push-fixes.js), run by
entrypoint before every `db push`):

1. `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS` for `BACKEND_TEAM` and
   `ON_FIELD_TEAM` (additive, non-destructive).
2. Remap existing rows: `SALES_MANAGER`/`SUPPORT` → `BACKEND_TEAM`,
   `SALES_EXEC`/`VIEWER` → `ON_FIELD_TEAM`.
3. `CREATE TABLE IF NOT EXISTS` for the three new tables (with their indexes
   and FK), so `db push` sees them as already present and only needs to
   resolve the now-decoupled enum alter.

Two smaller bugs found and fixed alongside this (same root cause — code
still referencing the dropped `SUPPORT`/`VIEWER` roles):

- `app/api/daily-activity/unlock/route.ts` gated the unlock-request
  review endpoints to `['SUPER_ADMIN', 'ADMIN', 'SUPPORT']` — since `SUPPORT`
  no longer exists as a role, nobody but SUPER_ADMIN/ADMIN could review
  requests. Changed to `BACKEND_TEAM`.
- `app/api/dashboard/route.ts` had a dead `role === 'SUPPORT' || role ===
  'VIEWER'` branch (unreachable — those roles don't exist anymore) returning
  a ticket-shaped payload for a ticketing feature that was already removed in
  an earlier migration (`remove_ticket_functionality`). Removed the branch.

**Commits:** `772e4e3`, `bff95af`, `a6cdb21` on `main`.

**Verification:** `docker compose ps` showed `Up`, `docker logs` showed
`✓ Ready in 1326ms` with no further restarts, `curl` to `/login` returned
`200`.

---

## 6. Known gaps / things to watch

- `app/api/health` has no `route.ts` — hitting it 404s. Harmless (nothing
  currently depends on it), but worth adding if an uptime monitor ever needs
  a real liveness endpoint.
- No migration history — every schema change is a live `db push` against
  production data on next deploy. Any future enum value removal or new
  table with a dependent-type column should be checked against the pattern
  in §5 before merging.
- `deployserverlog .md` (repo root, git-ignored) holds a real GitHub PAT and
  DB password from initial setup — rotate the PAT if this file is ever
  shared or synced anywhere.
