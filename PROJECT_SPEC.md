# eOrbitor Pulse - Project Specification
## Local/On-Premise CRM Platform

---

## Project Summary

**eOrbitor Pulse** is an enterprise-grade CRM platform for local/on-premise deployment within organizations. It manages the complete customer lifecycle through 6 SPANCO phases: Suspect → Prospect → Approach → Negotiation → Closure → Ongoing.

**Deployment:** Local network only (no cloud)
**Tech Stack:** Next.js 14, Node.js 18+, PostgreSQL 15+
**Target Users:** Sales teams, account managers, support staff
**UI Philosophy:** Minimalistic, professional, easy-to-use

---

## 6 Core Business Phases (SPANCO)

1. **SUSPECT** - Lead generation and capture
2. **PROSPECT** - Lead qualification (BANT analysis)
3. **APPROACH** - Initial customer contact
4. **NEGOTIATION** - Quotation and proposal
5. **CLOSURE** - Order processing and payment
6. **ONGOING** - Post-sales support and relationship

---

## Key Features

### Modules (10)
- Lead Management (capture, scoring, qualification)
- Customer Master (company info, contacts, relationships)
- Sales Pipeline (Kanban board, deal tracking)
- Quotations (create, approve, PDF generation)
- Orders (PO processing, delivery, payment tracking)
- Tasks & Follow-ups (calendar, reminders, scheduling)
- Inventory (stock management, vendors, procurement)
- Support (ticketing, SLA tracking, resolution)
- Reports & Analytics (8+ pre-built reports)
- Settings & Admin (company config, user management, RBAC)

### Database Tables (15 Core)
- Users, Leads, Customers, Contacts
- Deals, Follow-ups, Tasks
- Quotations, Orders, Products, Inventory, Vendors
- Tickets, Activity Logs, Notifications

---

## Technology Stack

### Frontend
- React 18 + Next.js 14 (App Router)
- TypeScript for type safety
- Tailwind CSS for styling (minimalistic design)
- ShadCN UI for components

### Backend
- Node.js 18+ (LTS)
- Express.js via Next.js API routes
- Prisma ORM for database
- JWT authentication (internal only)

### Database
- PostgreSQL 15+ (self-hosted)
- Automated daily backups
- 7-day rolling backup retention

### Infrastructure
- Nginx (reverse proxy)
- PM2 (process manager)
- Firewall (IP restriction)
- Local file storage

---

## UI/UX Principles

1. **Minimalistic** - Clean, uncluttered design
2. **Professional** - Corporate appearance with logo
3. **Fast** - Responsive, quick navigation
4. **Intuitive** - Clear workflows following business processes
5. **Accessible** - Easy for non-technical users

---

## Color Palette
- Primary: #0066CC (Blue)
- Success: #00AA44 (Green)
- Warning: #FF9900 (Orange)
- Error: #CC0000 (Red)
- Neutral: #666666 (Gray)

---

## File Structure
```
eOrbitor_Pulse/
├── app/
│   ├── (auth)/         # Login, signup
│   ├── (dashboard)/    # Main app pages
│   ├── api/            # API routes
│   └── globals.css
├── components/         # Reusable React components
├── lib/                # Utilities, helpers, logger
├── prisma/             # Database schema, migrations
├── public/             # Static files, logo
├── logs/               # Chat session logs (auto-created)
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── PROJECT_SPEC.md     # This file
```

---

## Default Login Credentials
- **Email:** admin@company.local
- **Password:** password
- **Role:** ADMIN

Alternative test user:
- **Email:** sales@company.local
- **Password:** password
- **Role:** SALES_EXEC

---

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- PostgreSQL 15+ running locally
- `.env.local` file configured with database credentials

### Installation
```bash
npm install
npm run prisma:generate
npm run db:push              # Create database schema
npm run db:seed              # Seed default users
npm run dev                  # Start development server
```

Access: `http://localhost:3000`

---

## API Endpoints (Key)

### Auth
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard` - KPI data

### Leads (To be implemented)
- `GET /api/leads`
- `POST /api/leads`
- `GET /api/leads/:id`
- `PATCH /api/leads/:id`
- `DELETE /api/leads/:id`

### Similar patterns for: customers, deals, quotations, orders, tasks, support

---

## Logging System

All prompts and responses are automatically logged with timestamps in `/logs/chat_YYYY-MM-DD.txt`

Format:
```
[ISO_TIMESTAMP] TYPE: Content
  Metadata: {...}
```

Types: `prompt`, `response`, `data`, `error`, `system`

---

## Development Notes

1. Keep UI minimalistic - focus on functionality
2. Follow SPANCO phases in UI flows
3. Always validate inputs on both frontend and backend
4. Log important operations for audit trail
5. Maintain responsive design (desktop priority)

---

**Version:** 1.0.0  
**Last Updated:** 2026-05-25  
**Status:** UI Foundation Complete - Ready for Module Development
