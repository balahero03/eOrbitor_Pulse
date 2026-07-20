# CLAUDE.md

Complete guidance and map for working in the **eOrbitor Pulse** codebase.

---

## 1. What this is

eOrbitor Pulse is a self-hosted, on-premise **B2B CRM** for an IT / technology
**solutions reseller / systems integrator** (deals in HPE, Dell, Cisco, Fortinet,
Nutanix, VMware, etc. — see `OEM_LIST` in [lib/eorbitor-constants.ts](lib/eorbitor-constants.ts)).
It manages the full sales lifecycle using the **SPANCO** methodology:

> Suspect → Prospect → Approach → Negotiation → Closure → Ongoing

It is India-focused: GST numbers on customers/vendors, INR (₹), 18% GST default,
`en-IN` date/number formatting.

> ⚠️ **Docs drift:** `README.md` and `PROJECT_SPEC.md` describe an earlier v2.0
> and are partly out of date (they mention Inventory/Support/ShadCN pages and a
> "57 endpoints" count that no longer exactly match). The **Prisma schema and
> `app/api` routes are the source of truth.** Modules added after those docs:
> daily activity + unlock workflow, approvals, appraisal/personal/team reports
> engine, time tracking, announcements, lead closure workflow, customer import.

---

## 2. Tech stack

| Layer      | Choice |
|------------|--------|
| Framework  | Next.js 16 (App Router), React 18, TypeScript 5 |
| Styling    | Tailwind CSS 3 (+ `@headlessui/react`, `@heroicons/react`, `clsx`) |
| DB / ORM   | PostgreSQL (16 in Docker) + Prisma 5 |
| Auth       | Custom JWT (`jsonwebtoken`), bcrypt (`bcryptjs`); token in `localStorage`, 30-day expiry |
| Email      | `nodemailer` (SMTP; no-ops with a console log if `SMTP_HOST` unset) |
| Charts     | `recharts` |
| Realtime   | `socket.io` / `socket.io-client` declared (feature-flagged, not core) |
| Deploy     | Docker + `docker-compose.yml`; GitHub Actions **self-hosted runner** in `actions-runner/` |

---

## 3. Commands

```bash
npm run dev              # dev server → http://localhost:3000
npm run build            # production build
npm run start            # production server
npm run lint             # next lint
npm run type-check       # tsc --noEmit

npm run prisma:generate  # regenerate Prisma client — RUN AFTER ANY schema change
npm run prisma:migrate   # prisma migrate dev (migrations/ exists but db:push is the norm)
npm run db:push          # sync schema to DB without migration files (primary workflow)
npm run db:seed          # seed via prisma/seed.js
```

Default seeded admin login: **`admin@company.local` / `password`**
(alt: `sales@company.local` / `password`).

### Docker
`docker-compose.yml` defines two services: `db` (postgres:16, volume `pgdata`,
healthcheck) and `app` (built from `Dockerfile`, `depends_on` db healthy,
`env_file: .env.local`, exposes port). Container entry: `docker/entrypoint.sh`.
For the production host, actual deploy commands, and the standing risk of
`db push`-only schema sync against live data, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## 4. Repository layout

```
eOrbitor_Pulse/
├── app/
│   ├── layout.tsx, page.tsx            # root layout + landing/redirect
│   ├── (auth)/login/page.tsx           # login screen
│   ├── (dashboard)/                    # authed app shell + all feature pages
│   │   ├── layout.tsx                  # sidebar, RBAC nav, notif polling, logout
│   │   └── <module>/{page,new,[id]}    # list / create / detail per module
│   └── api/**/route.ts                 # REST handlers (see §7 full map)
├── components/
│   └── MultiSelectSearch.tsx           # the ONE shared component (solution areas / OEM / presales)
├── lib/                                # see §6
├── prisma/
│   ├── schema.prisma                   # DB schema — source of truth (see §5)
│   ├── seed.js, seed-users.js, seed-mockdata.js
│   ├── import-leads.js, import-leads-2026.js
│   └── migrations/
├── scripts/
│   ├── db-backup.sh, db-restore.sh     # pg_dump / restore helpers
│   ├── pre-push-fixes.js               # pre-`db push` data/schema patches — see DEPLOYMENT.md §5
│   └── reassign-leads.js, reseed-leads.js
├── docker/entrypoint.sh
├── docker-compose.yml, Dockerfile, .dockerignore
├── .env.local(.example)                # ~120 config keys (see §9)
├── README.md, PROJECT_SPEC.md          # partly outdated (see §1)
├── DEPLOYMENT.md                       # production host, deploy steps, incident log
└── CLAUDE.md                           # this file
```

---

## 5. Data model (`prisma/schema.prisma`)

PostgreSQL. Conventions used throughout:
- **Soft delete** via `deletedAt` (User, Lead, Customer, Deal, Quotation) — filter `deletedAt: null`.
- **Audit** via `ActivityLog`; **user alerts** via `Notification`.
- `cuid()` string PKs; `createdAt` / `updatedAt` timestamps.

### Models

| Model | Purpose / key fields |
|-------|----------------------|
| **User** | Auth + org hierarchy. `role`, `managerId` → self-relation (`manager`/`subordinates`), `isActive`, `department`, `assignedTerritory`, `employeeId`. Owns leads, deals, tasks, quotations, activity, time logs, reports. |
| **Lead** | The central sales object. `status` (LeadStatus), `source`, `leadScore`, `assignedToId`, `broughtById`, RFQ fields (`rfqDate`, `quoteNo`, `quoteValue`, `poReceivedDate`), `followUpDate`, `expectedClosureDate`, closure fields (`closedAt`, `closureReason`, `closureDetails` JSON), array tags `solutionAreas[]`, `oemNames[]`, `presalesIds[]`, optional `linkedCustomerId`. |
| **Customer** | Company master. Unique `gstNumber`, `customerCategory`, `billingAddress`/`shippingAddress` JSON, `annualRevenue`. Has contacts, deals, leads, orders, quotations. |
| **Contact** | Person under a Customer. `isPrimary`, `designation`. Cascade-deletes with customer. |
| **Deal** | SPANCO opportunity. `stage` (DealStage), `dealValue`, `winProbability`, `expectedCloseDate`, `lostReason`. Links customer + optional lead. |
| **FollowUp** | Call/email/meeting/whatsapp/site-visit record. `scheduledDate`, `actualDate`, `outcome`, `reminderSentAt`. Belongs to Deal (cascade), optional Lead. |
| **Task** | `status`, `priority`, `dueDate`, `assignedToId` vs `createdById`, optional `relatedDealId`/`relatedFollowUpId`, `tags[]`. |
| **Quotation** | Unique `quotationNumber`, `status`, `items` JSON, money fields (`subtotal`/`taxAmount`/`discountAmount`/`totalAmount`), `revision`, approval (`approvedById`/`approvedAt`), `sentAt`, `pdfUrl`. |
| **Order** | Unique `orderNumber`, `poNumber`/`poDate`, `status` (OrderStatus), `paymentStatus`, `totalAmount`/`amountPaid`, `paymentMode`/`paymentProofUrl`, `deliveryDate`/`deliveredAt`, `invoiceUrl`. |
| **Product** | Catalog. Unique `sku`, `oemName`, `basePrice`, `tax`, `attributes` JSON. Has one `Inventory`, many `VendorProduct`. |
| **Inventory** | 1:1 with Product. `quantity`, `reorderLevel`, `warehouseLocation`, restock fields. |
| **Vendor** | Unique `gstNumber`, `rating`, `paymentTerms`. Many `VendorProduct`. |
| **VendorProduct** | Join Vendor×Product (unique). `vendorSku`, `vendorPrice`, `leadTime`, `minimumOrder`. |
| **ActivityLog** | Audit trail. `action` (ActivityAction), `entityType`/`entityId`, `changes` JSON, `ipAddress`/`userAgent`, optional FK links to lead/customer/deal/quotation. |
| **Notification** | Per-user. `type` (NotificationType), `isRead`/`readAt`, `relatedEntityType`/`Id`. Cascade with user. |
| **ApprovalRequest** | Governance. `type` (LEAD_DELETE/LEAD_REOPEN/ORDER_DELETE/CUSTOMER_DELETE), `status`, `requestedBy`/`approvedBy`, `reason`/`rejectionReason`, optional `leadId`. |
| **DailyActivity** | HR log, unique `(userId, date)` (date is a `YYYY-MM-DD` string). `activities` (JSON string), `loginTime`/`logoutTime`/`totalHours`, `isEditable` + `unlockedBy`/`unlockedAt` lock workflow. |
| **ActivityUnlockRequest** | Request to re-edit a locked DailyActivity. `reason`, `status`, `reviewedBy`/`reviewedAt`. |
| **TimeLog** | Login/logout session tracking. `loginTime`/`logoutTime`/`sessionDuration`. |
| **Announcement** | `title`/`content`, `isPublished`/`publishedAt`/`expiresAt`, `priority`. |
| **Report** | Cached generated report. `type`, `startDate`/`endDate`, `data` JSON, `expiresAt`, `createdById`. |
| **ScheduledReport** | Cron-driven report definition. `frequency`, `dayOfWeek`/`dayOfMonth`, `recipients[]`, `nextRunAt`. (No route wired yet — future.) |

### Enums
- **UserRole:** `SUPER_ADMIN`, `ADMIN`, `SALES_MANAGER`, `SALES_EXEC`, `SUPPORT`, `VIEWER`
- **LeadStatus:** `NEW, CONTACTED, QUALIFIED, REJECTED, CONVERTED, SUSPECT, PROSPECT, APPROACH, PROPOSAL, NEGOTIATION, CLOSURE, WON, LOST, DROPPED, ON_HOLD, ORDER`
  - **Closed statuses** (excluded from active lead lists): `WON, LOST, DROPPED, ORDER`
- **LeadSource:** `WEBSITE, REFERRAL, WALKIN, CALL, EMAIL, ADVERTISEMENT`
- **CustomerCategory:** `PROSPECT, ACTIVE, INACTIVE, LOST`
- **DealStage:** `SUSPECT, PROSPECT, APPROACH, NEGOTIATION, CLOSURE, ONGOING`
- **FollowUpType:** `CALL, EMAIL, MEETING, WHATSAPP, SITE_VISIT`
- **TaskStatus:** `TODO, IN_PROGRESS, COMPLETED, CANCELLED` · **TaskPriority:** `LOW, MEDIUM, HIGH, URGENT`
- **QuotationStatus:** `DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED`
- **OrderStatus:** `PENDING, CONFIRMED, FULFILLED, INVOICED, COMPLETED` · **PaymentStatus:** `PENDING, PARTIAL, COMPLETED`
- **ActivityAction:** `CREATE, UPDATE, DELETE, VIEW, EXPORT, SEND_EMAIL`
- **NotificationType:** `FOLLOW_UP_REMINDER, TASK_DUE, DEAL_UPDATED, LEAD_ASSIGNED, QUOTATION_APPROVED, ORDER_CONFIRMED, PAYMENT_RECEIVED, APPROVAL_REQUESTED, APPROVAL_APPROVED, APPROVAL_REJECTED, TASK_ASSIGNED, USER_INACTIVE`
- **ApprovalType:** `LEAD_DELETE, LEAD_REOPEN, ORDER_DELETE, CUSTOMER_DELETE` · **ApprovalStatus:** `PENDING, APPROVED, REJECTED`

---

## 6. `lib/` — shared code

| File | Role |
|------|------|
| [lib/prisma.ts](lib/prisma.ts) | The shared `prisma` singleton (global in dev to avoid hot-reload leaks). **Use this everywhere.** |
| [lib/middleware/auth.ts](lib/middleware/auth.ts) | `withAuth(handler)` — verifies Bearer JWT (`JWT_SECRET`, fallback `'dev-secret'`), injects `AuthUser {id,email,role,...}`, and centrally catches thrown errors (`err.status`/`err.message`). `requireRoles(roles)(handler)` — 403 wrapper (available but **most routes gate inline** via `user.role` checks instead). |
| [lib/roles.ts](lib/roles.ts) | `ADMIN_ROLES` = [SUPER_ADMIN, ADMIN]; `MANAGER_ROLES` = [+SALES_MANAGER]; `isAdmin()`, `isManagerOrAbove()`. |
| [lib/errors.ts](lib/errors.ts) | Typed errors with `.status`: `ValidationError`(400), `NotFoundError`(404), `ForbiddenError`(403), `UnauthorizedError`(401). Throw inside a `withAuth` handler to return that HTTP code. |
| [lib/notify.ts](lib/notify.ts) | `createNotification(userId,type,title,msg,...)` and `notifyAdminsAndManagers(...)` (fan-out to active admins/managers, optional exclude). Failures are swallowed + logged. |
| [lib/mail.ts](lib/mail.ts) | `sendMail({to,subject,html,attachments})` (nodemailer; console no-op without SMTP). HTML builders `buildWonEmail()` / `buildLostEmail()` for lead-closure notifications. |
| [lib/logger.ts](lib/logger.ts) | File logger → `logs/chat_YYYY-MM-DD.txt`. `logPrompt/Response/Data/Error/System`. |
| [lib/reports/calculator.ts](lib/reports/calculator.ts) | `reportCalculator` singleton (`ReportCalculator` class, ~535 LOC) — computes personal / team / pipeline / appraisal analytics consumed by the reports routes. |
| [lib/eorbitor-constants.ts](lib/eorbitor-constants.ts) | Domain constants: `SOLUTION_AREAS` (Compute, Cloud, Networking, Cyber Security, Data Centre, Managed Services, VC, Specialization Zone, Accessories, Other) and `OEM_LIST` (~48 vendors). |
| [lib/hooks/useCurrentUser.ts](lib/hooks/useCurrentUser.ts) | Client hook: reads token, fetches `/api/auth/me`, redirects to `/login` on failure. |
| [lib/hooks/useRequireRole.ts](lib/hooks/useRequireRole.ts) | Client hook: redirects to `/dashboard` if role not allowed (UI gate; **not** a security boundary). |
| [lib/types/index.ts](lib/types/index.ts) | Shared TypeScript types. |

---

## 7. API map (`app/api/**/route.ts`)

All routes (except `auth/login`) run through `withAuth`. Method list per route:

**Auth & identity**
- `POST /api/auth/login` — bcrypt check, active check, issues JWT; also creates a `TimeLog`, auto-closes any stale prior-day session, and upserts today's `DailyActivity` (see [route](app/api/auth/login/route.ts)).
- `GET /api/auth/me` — current user from token.

**Leads**
- `GET,POST /api/leads` — list (role-scoped, rich filters: status/source/search/assignedTo/RFQ dates/followup dates/quote value) + create.
- `GET,PATCH,DELETE /api/leads/[id]`
- `POST /api/leads/[id]/close` — closure workflow (WON/LOST/DROPPED/ORDER); sends Won/Lost email + notifications.
- `POST /api/leads/[id]/followups` — add follow-up to a lead.
- `GET /api/leads/closed` — closed leads list.
- `GET /api/leads/won` — won leads list.

**Customers** — `GET,POST /api/customers` · `.../[id]` (currently no handlers exported) · `POST /api/customers/import` (bulk).

**Deals** — `GET,POST /api/deals` · `GET,PATCH,DELETE /api/deals/[id]` · `POST /api/deals/[id]/move` (Kanban stage change).

**Follow-ups** — `GET,POST /api/followups` · `GET,PATCH,DELETE /api/followups/[id]`.

**Tasks** — `GET,POST /api/tasks` (create notifies assignee) · `GET,PATCH,DELETE /api/tasks/[id]` · `POST /api/tasks/[id]/complete`.

**Quotations** — `GET,POST /api/quotations` · `GET,PATCH,DELETE /api/quotations/[id]` · `POST /api/quotations/[id]/approve` · `POST /api/quotations/[id]/send`.

**Orders** — `GET,POST /api/orders` · `GET,PATCH,DELETE /api/orders/[id]` · `POST /api/orders/[id]/confirm` · `.../fulfill` · `.../payment`.

**Products** — `GET,POST /api/products` · `GET,PATCH,DELETE /api/products/[id]`.

**Users** — `GET,POST /api/users` · `GET,PATCH,DELETE /api/users/[id]` · `POST /api/users/[id]/reassign` (reassign a user's records) · `GET /api/users/[id]/records`.

**Approvals** — `GET,POST /api/approval-requests` (create notifies admins/managers) · `PATCH /api/approval-requests/[id]` (approve/reject; notifies requester).

**Daily activity / attendance** — `GET,POST /api/daily-activity` · `GET /api/daily-activity/team` · `GET,POST,PATCH /api/daily-activity/unlock` (unlock request + review) · `GET,POST /api/time-tracking` (login/logout sessions).

**Announcements** — `GET,POST /api/announcements` · `GET,PATCH,DELETE /api/announcements/[id]`.

**Notifications** — `GET /api/notifications` · `POST /api/notifications/[id]/read` · `POST /api/notifications/read-all`.

**Reports** — `GET /api/reports/personal` · `.../team` · `.../pipeline` · `.../recent` · `GET /api/reports/[id]` (fetch cached). (Backed by `reportCalculator`.)

**Dashboard** — `GET /api/dashboard` — role-specific KPI payload.

**Activity logs** — `GET,POST /api/activity-logs` — the audit-trail read/write endpoint.

**Cron** — `POST /api/cron/inactive-users` — flags inactive users, notifies admins/managers (called by an external scheduler).

**Health** — `app/api/health` — liveness probe.

---

## 8. Frontend pages (`app/(dashboard)`)

Each feature typically has `page.tsx` (list) plus `new/page.tsx` and `[id]/page.tsx`.
Pages are **client components** that `fetch` the API directly with the `localStorage` token.

- `dashboard/` — role-routed: `components/{AdminDashboard, ManagerDashboard, SalesExecDashboard, SupportDashboard}.tsx`.
- `leads/`, `leads/new`, `leads/[id]` · `closed-leads/`
- `customers/`, `customers/new`, `customers/[id]`
- `followups/`, `followups/new`, `followups/[id]`
- `orders/`, `orders/new`, `orders/[id]`
- `products/`, `products/new`, `products/[id]`
- `quotations/`, `quotations/new`, `quotations/[id]`
- `tasks/`, `tasks/new`, `tasks/[id]`
- `reports/`, `reports/[id]`
- `daily-activity/` · `attendance/` · `approvals/` · `announcements/` · `users/`

Shell: [app/(dashboard)/layout.tsx](app/(dashboard)/layout.tsx) — role-filtered sidebar
(`NAV_GROUPS`), notification bell polling every 30s, JWT check, logout (posts a
`LOGOUT` to `/api/time-tracking`). Only shared component: [components/MultiSelectSearch.tsx](components/MultiSelectSearch.tsx).

---

## 9. Security & access-control model

- **JWT** signed with `JWT_SECRET` (dev fallback `'dev-secret'` — set a real secret in prod), 30-day expiry, stored in `localStorage`, sent as `Authorization: Bearer`.
- **Passwords** bcrypt-hashed; login rejects inactive users.
- **Server-side RBAC is the real boundary.** Two mechanisms:
  1. `requireRoles([...])` wrapper (available in [auth.ts](lib/middleware/auth.ts)).
  2. **Inline `user.role` checks** — the prevalent pattern in practice.
- **Role-based data scoping is enforced *in the query*, not just the UI.** Canonical pattern (see [app/api/leads/route.ts](app/api/leads/route.ts#L30-L47)):
  - `SALES_EXEC` → only own records (`assignedToId === user.id`)
  - `SALES_MANAGER` → own + subordinates' (subordinates via `User.managerId`)
  - `ADMIN` / `SUPER_ADMIN` → everything
  Replicate this in **any** new endpoint returning user-owned data. Also gate
  filter overrides (e.g. `assignedToId` query param only honored for manager+).
- **Client role hooks** (`useRequireRole`, nav filtering) are UX only — never rely on them for authorization.
- **Governance:** destructive actions (lead/order/customer delete, lead reopen) route through `ApprovalRequest` + `ActivityLog`, not silent deletes. Prefer soft delete (`deletedAt`).

---

## 10. Configuration (`.env.local`)

~120 keys (template in `.env.local.example`). Load-bearing ones:
`DATABASE_URL`, `JWT_SECRET`, `PORT`, `SMTP_*` (email), `DEFAULT_TAX_RATE` (18),
`CURRENCY_SYMBOL` (₹), `TIMEZONE`/`LOCALE` (India), `PAGINATION_*`, `BACKUP_*`.
Many `FEATURE_*` / `SOCKET_IO_*` flags exist for capabilities not all wired
(cloud export, public API, socket.io, calendar) — treat unflagged features as off.

---

## 11. Conventions when working here

1. **After editing `schema.prisma`:** `npm run prisma:generate`, then `npm run db:push` to apply.
2. **New API route:** wrap in `withAuth`; use the `prisma` singleton; apply the §9 role-scoping pattern; throw typed errors from [lib/errors.ts](lib/errors.ts) for non-500s.
3. **Respect soft delete** (`deletedAt: null` filters) and **write audit/notify** where siblings do (`ActivityLog`, `createNotification`/`notifyAdminsAndManagers`).
4. **Money:** Prisma `Decimal` — coerce with `Number(...)`; format `toLocaleString('en-IN')` with ₹.
5. **Match existing style** — no shared component library beyond `MultiSelectSearch`; pages fetch APIs client-side with the token.
6. **Don't trust README/PROJECT_SPEC for current behavior** — verify against schema/routes.
7. **Git:** only commit or push when explicitly asked; branch off `main` first if needed.
