# eOrbitor Pulse - Setup Guide

## Quick Start (Local Development)

### Step 1: Prerequisites
- Node.js 18+ and npm installed
- PostgreSQL 15+ running on localhost:5432
- Git (for version control)

### Step 2: Environment Configuration
Copy `.env.local.example` to `.env.local` and update:
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
DATABASE_URL="postgresql://eorbitor:password@localhost:5432/eorbitor_pulse"
JWT_SECRET="your-random-secret-here"
SESSION_SECRET="your-random-secret-here"
NODE_ENV="development"
PORT=3000
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Database Setup
```bash
# Generate Prisma client
npm run prisma:generate

# Create database schema
npm run db:push

# Seed with default users
npm run db:seed
```

### Step 5: Start Development Server
```bash
npm run dev
```

Visit: `http://localhost:3000`

Default login:
- Email: `admin@company.local`
- Password: `password`

---

## Project Structure

### /app
- **`(auth)/`** - Authentication pages (login)
- **`(dashboard)/`** - Main application pages
  - `dashboard/` - Dashboard with KPIs
  - `leads/` - Lead management
  - `customers/` - Customer management
  - `pipeline/` - Sales pipeline (Kanban)
  - `quotations/` - Quotation management
  - `orders/` - Order management
  - `tasks/` - Task management
  - `support/` - Support tickets
  - `reports/` - Analytics & reports
  - `settings/` - Configuration & user management
- **`api/`** - API routes
  - `auth/` - Authentication endpoints
  - `dashboard/` - Dashboard data
  - (More endpoints to be added)

### /components
Reusable React components (to be created as needed)

### /lib
- `logger.ts` - Logging system for chat/prompts
- Database utilities
- Authentication utilities
- Helper functions

### /prisma
- `schema.prisma` - Database schema (15 tables)
- `seed.js` - Seed script for default data

### /public
- `eOrbitor_logo.jpg` - Application logo

### /logs
Auto-generated chat session logs with timestamps

---

## Database Tables

### User Management
- `users` - System users with roles

### CRM Core
- `leads` - Lead records
- `customers` - Customer companies
- `contacts` - Customer contacts
- `deals` - Sales opportunities

### Sales Operations
- `quotations` - Price quotes
- `orders` - Customer orders
- `follow_ups` - Call/email/meeting records
- `tasks` - Task assignments

### Operations
- `products` - Product catalog
- `inventory` - Stock levels
- `vendors` - Vendor information
- `tickets` - Support tickets

### System
- `activity_logs` - Audit trail
- `notifications` - User notifications

---

## Key Commands

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run linting
npm run type-check       # Check TypeScript
```

### Database
```bash
npm run prisma:generate  # Generate Prisma client
npm run db:push          # Sync schema with DB (dev only)
npm run db:seed          # Seed default data
```

### Migrate (when schema changes)
```bash
npm run prisma:migrate
```

---

## Development Workflow

### 1. Create New Page
```tsx
// app/(dashboard)/[module]/page.tsx
'use client';

export default function ModulePage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Module Name</h1>
      {/* Content here */}
    </div>
  );
}
```

### 2. Create New API Endpoint
```ts
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Logic here
  return NextResponse.json({ data: [] });
}
```

### 3. Update Database Schema
1. Edit `prisma/schema.prisma`
2. Run: `npm run prisma:migrate` (creates migration)
3. Commit migration to git

### 4. Log Data (for audit trail)
```ts
import { logPrompt, logData, logError } from '@/lib/logger';

logPrompt('User action description');
logData('Important data', { userId: '123', action: 'create' });
logError('Error occurred', { errorCode: 'DB_ERROR' });
```

---

## UI Styling

### Using Tailwind CSS
```tsx
<div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
  <h2 className="text-2xl font-bold mb-4">Title</h2>
  <button className="btn btn-primary">Action</button>
</div>
```

### Custom Button Classes
- `.btn.btn-primary` - Blue action button
- `.btn.btn-secondary` - Gray secondary button
- `.btn.btn-danger` - Red destructive action
- `.btn.btn-success` - Green positive action

### Custom Component Classes
- `.card` - White card with border and shadow
- `.badge` - Small label (badge-primary, badge-success, etc.)

---

## Logging System

All prompts and responses are logged automatically to `/logs/chat_YYYY-MM-DD.txt`

Manual logging:
```ts
import { logPrompt, logResponse, logData, logError, logSystem } from '@/lib/logger';

logPrompt('User requested...');
logResponse('System responded...');
logData('Data point', { value: 123 });
logError('Error occurred', { code: 'ERR_001' });
logSystem('System initialized');
```

---

## Authentication Flow

1. User submits login form
2. `POST /api/auth/login` validates credentials
3. Returns JWT token on success
4. Token stored in `localStorage`
5. Dashboard layout checks token on mount
6. All API calls include token in Authorization header
7. Backend verifies token on each request

---

## Security Notes

- ✅ Never commit `.env.local` to git
- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ JWT tokens expire in 30 days
- ✅ API validates all inputs
- ✅ SQL injection prevented by Prisma ORM
- ✅ Activity logging for audit trail
- ✅ Role-based access control (RBAC) ready

---

## Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h localhost -U eorbitor -d eorbitor_pulse
```

### Port 3000 Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Prisma Schema Issues
```bash
# Reset database (dev only!)
npx prisma migrate reset

# Then reseed
npm run db:seed
```

---

## Next Steps

1. ✅ UI Foundation: Complete
2. ⏳ Leads Module: Implement CRUD, list, scoring
3. ⏳ Customers Module: Master data, contacts
4. ⏳ Pipeline Module: Kanban board, deal tracking
5. ⏳ Quotations Module: Create, approve, PDF
6. ⏳ Orders Module: PO processing, fulfillment
7. ⏳ Reports Module: Analytics dashboard
8. ⏳ Integration: Socket.io real-time updates
9. ⏳ Testing: Unit and integration tests
10. ⏳ Deployment: Production setup

---

**Last Updated:** 2026-05-25  
**Version:** 1.0.0
