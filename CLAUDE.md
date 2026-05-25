# eOrbitor Pulse - CRM & Business Operations Platform

## Project Overview

**eOrbitor Pulse** is an enterprise-grade CRM (Customer Relationship Management) and Business Operations Platform designed for B2B service providers. It manages the complete customer lifecycle from lead acquisition through post-sales support, with integrated inventory, quotation, and order management.

**Target Users:** Sales teams, account managers, support staff, and business administrators

**Primary Goal:** Digitize and streamline the entire sales and customer management process with real-time collaboration, automated workflows, and actionable insights.

---

## Technology Stack

- **Frontend:** React 18 + Next.js 14 (App Router)
- **Styling:** Tailwind CSS + ShadCN UI Components
- **Language:** TypeScript
- **Backend:** Node.js + Express.js (API routes in Next.js)
- **Database:** PostgreSQL 15+ with Prisma ORM
- **Real-time:** Socket.io for live notifications and collaboration
- **Authentication:** NextAuth.js with JWT tokens
- **PDF Generation:** PDFKit for quotation and invoice PDFs
- **Charts:** Chart.js or Recharts for analytics
- **Calendar:** FullCalendar for scheduling
- **Drag-Drop:** @dnd-kit for kanban board
- **File Upload:** Multer for document management
- **Email:** Nodemailer for email communications

---

## Application Architecture

### High-Level Flow

```
User Login (Auth)
    ↓
Dashboard (Real-time KPIs, Activity Feed)
    ↓
┌─────────────────────────────────────────┐
│  6 Core Business Phases (SPANCO)        │
├─────────────────────────────────────────┤
│ 1. SUSPECT    - Lead Capture & Scoring  │
│ 2. PROSPECT   - Lead Qualification      │
│ 3. APPROACH   - Initial Contact         │
│ 4. NEGOTIATION- Quotation & Proposal    │
│ 5. CLOSURE    - Order & Payment         │
│ 6. ONGOING    - Support & Relationship  │
└─────────────────────────────────────────┘
    ↓
Supporting Systems (Parallel Processing)
├── Inventory & Procurement
├── Document Management
├── Activity Logging
├── Notifications
├── RBAC & Permissions
└── Analytics & Reporting
```

---

## Page Structure (32 Pages)

### 1. Authentication Flow (3 pages)
- **`/login`** - Login with email/password
- **`/forgot-password`** - Password reset flow
- **`/setup-profile`** - First-time user onboarding

### 2. Dashboard (1 page)
- **`/dashboard`** - Main hub with KPIs, pipeline overview, activity feed

### 3. Lead Management (4 pages)
- **`/leads`** - List of all leads with filters, search, pagination
- **`/leads/new`** - Create new lead form (web form, CSV import)
- **`/leads/:id`** - Lead detail view with timeline
- **`/leads/:id/edit`** - Edit lead information

### 4. Customer Management (3 pages)
- **`/customers`** - Master list of customers (companies)
- **`/customers/new`** - Register new customer
- **`/customers/:id`** - Customer profile with contact persons, deals, timeline

### 5. Sales Pipeline (3 pages)
- **`/pipeline`** - Kanban board (SPANCO stages) with drag-drop
- **`/pipeline/:dealId`** - Deal detail modal/page with full history
- **`/opportunities`** - List view of opportunities with filtering

### 6. Follow-ups & Tasks (3 pages)
- **`/follow-ups`** - Calendar + list view of follow-ups (calls, emails, meetings)
- **`/tasks`** - Task management board (priority, assignee, due date)
- **`/calendar`** - Integrated calendar for scheduling

### 7. Quotations (3 pages)
- **`/quotations`** - List of all quotations with status
- **`/quotations/new`** - Create quotation (product selection, pricing, GST)
- **`/quotations/:id`** - View quotation with PDF preview, approval workflow

### 8. Orders (3 pages)
- **`/orders`** - Order management list
- **`/orders/new`** - Create order from quotation
- **`/orders/:id`** - Order details with delivery tracking, payment status

### 9. Inventory (2 pages)
- **`/inventory`** - Product catalog with stock levels
- **`/inventory/vendors`** - Vendor management for procurement

### 10. Support (2 pages)
- **`/support/tickets`** - Support ticket list with SLA tracking
- **`/support/tickets/:id`** - Ticket detail with resolution workflow

### 11. Reports & Analytics (2 pages)
- **`/reports`** - Pre-built reports, custom report builder, exports
- **`/analytics`** - Advanced dashboards (funnel, performance, forecasting)

### 12. Settings & Admin (3 pages)
- **`/settings/company`** - Company configuration
- **`/settings/users`** - User management (RBAC, permissions)
- **`/settings/integrations`** - Email, WhatsApp, API integrations

---

## Database Schema (15 Core Tables)

### User Management
```
users
├── id (UUID, PK)
├── email (String, UNIQUE)
├── passwordHash (String)
├── firstName, lastName
├── role (ENUM: ADMIN, SALES_MANAGER, SALES_EXEC, SUPPORT, VIEWER)
├── department
├── assignedTerritory (String)
├── createdAt, updatedAt
└── deletedAt (soft delete)
```

### Lead Management
```
leads
├── id (UUID, PK)
├── name, email, phone
├── company
├── source (ENUM: WEBSITE, REFERRAL, WALKIN, CALL, EMAIL, ADVERTISEMENT)
├── status (ENUM: NEW, CONTACTED, QUALIFIED, REJECTED, CONVERTED)
├── leadScore (INT: 0-100)
├── qualificationNotes (BANT: Budget, Authority, Need, Timeline)
├── assignedToId (FK: users)
├── nextFollowUp (DateTime)
├── linkedCustomerId (FK: customers)
├── createdAt, updatedAt
└── source_metadata (JSON)
```

### Customer Master
```
customers
├── id (UUID, PK)
├── companyName (String)
├── gstNumber (String, UNIQUE)
├── industry (String)
├── website
├── annualRevenue (Decimal)
├── yearEstablished (INT)
├── primaryContactId (FK: contacts)
├── billingAddress (JSON)
├── shippingAddress (JSON)
├── leadId (FK: leads)
├── customerCategory (ENUM: PROSPECT, ACTIVE, INACTIVE, LOST)
├── createdAt, updatedAt
└── metadata (JSON)

contacts (for Customer)
├── id (UUID, PK)
├── customerId (FK)
├── name, email, phone, designation
├── isPrimary (Boolean)
└── createdAt
```

### Sales Pipeline
```
deals
├── id (UUID, PK)
├── customerId (FK: customers)
├── dealName (String)
├── dealValue (Decimal)
├── stage (ENUM: SUSPECT, PROSPECT, APPROACH, NEGOTIATION, CLOSURE, ONGOING)
├── winProbability (INT: 0-100)
├── expectedCloseDate (Date)
├── assignedToId (FK: users)
├── nextAction (String)
├── lostReason (String, nullable)
├── createdAt, updatedAt, closedAt
└── metadata (JSON)
```

### Follow-ups
```
follow_ups
├── id (UUID, PK)
├── dealId (FK: deals)
├── type (ENUM: CALL, EMAIL, MEETING, WHATSAPP, SITE_VISIT)
├── scheduledDate (DateTime)
├── actualDate (DateTime)
├── durationMinutes (INT)
├── notes (TEXT)
├── outcome (STRING)
├── nextAction (STRING)
├── attachments (JSON array of URLs)
├── createdById (FK: users)
├── updatedAt
└── reminderSentAt (DateTime)
```

### Tasks
```
tasks
├── id (UUID, PK)
├── title (String)
├── description (TEXT)
├── status (ENUM: TODO, IN_PROGRESS, COMPLETED, CANCELLED)
├── priority (ENUM: LOW, MEDIUM, HIGH, URGENT)
├── dueDate (DateTime)
├── assignedToId (FK: users)
├── relatedDealId (FK: deals, nullable)
├── relatedFollowUpId (FK: follow_ups, nullable)
├── createdById (FK: users)
├── createdAt, completedAt
└── tags (Array)
```

### Quotations
```
quotations
├── id (UUID, PK)
├── dealId (FK: deals)
├── quotationNumber (String, UNIQUE)
├── customerId (FK: customers)
├── status (ENUM: DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED)
├── issueDate (Date)
├── expiryDate (Date)
├── items (JSON array: {productId, quantity, unitPrice, tax})
├── subtotal (Decimal)
├── taxAmount (Decimal)
├── discountAmount (Decimal)
├── totalAmount (Decimal)
├── notes (TEXT)
├── pdfUrl (String)
├── sentAt (DateTime)
├── approvedById (FK: users, nullable)
├── approvedAt (DateTime, nullable)
├── createdById (FK: users)
├── createdAt, updatedAt
└── revision (INT, default: 1)
```

### Orders
```
orders
├── id (UUID, PK)
├── quotationId (FK: quotations)
├── customerId (FK: customers)
├── orderNumber (String, UNIQUE)
├── poNumber (String)
├── poDate (Date)
├── status (ENUM: PENDING, CONFIRMED, FULFILLED, INVOICED, COMPLETED)
├── deliveryDate (Date)
├── invoiceUrl (String)
├── paymentStatus (ENUM: PENDING, PARTIAL, COMPLETED)
├── totalAmount (Decimal)
├── amountPaid (Decimal)
├── createdAt, deliveredAt
└── timeline (JSON: {confirmed, fulfilled, invoiced, paid})
```

### Inventory
```
products
├── id (UUID, PK)
├── sku (String, UNIQUE)
├── name (String)
├── category (String)
├── description (TEXT)
├── basePrice (Decimal)
├── tax (Decimal, percentage)
├── isActive (Boolean)
├── createdAt, updatedAt
└── metadata (JSON)

inventory
├── id (UUID, PK)
├── productId (FK: products)
├── quantity (INT)
├── reorderLevel (INT)
├── warehouseLocation (String)
├── lastRestockDate (Date)
├── lastRestockQuantity (INT)
└── updatedAt
```

### Vendors
```
vendors
├── id (UUID, PK)
├── vendorName (String)
├── gstNumber (String)
├── email, phone
├── website
├── paymentTerms (String)
├── rating (INT: 1-5)
├── isActive (Boolean)
├── createdAt, updatedAt
└── metadata (JSON)

vendor_products
├── id (UUID, PK)
├── vendorId (FK: vendors)
├── productId (FK: products)
├── vendorSku (String)
├── vendorPrice (Decimal)
├── leadTime (INT: days)
└── minimumOrder (INT)
```

### Support Tickets
```
tickets
├── id (UUID, PK)
├── ticketNumber (String, UNIQUE)
├── customerId (FK: customers)
├── dealId (FK: deals, nullable)
├── type (ENUM: TECHNICAL, BILLING, GENERAL)
├── priority (ENUM: LOW, MEDIUM, HIGH, URGENT)
├── status (ENUM: OPEN, IN_PROGRESS, RESOLVED, CLOSED)
├── subject (String)
├── description (TEXT)
├── assignedToId (FK: users)
├── createdAt, resolvedAt, closedAt
├── slaBreached (Boolean)
├── resolutionNotes (TEXT)
├── customerSatisfactionRating (INT: 1-5, nullable)
└── attachments (JSON array)
```

### Activity Logging
```
activity_logs
├── id (UUID, PK)
├── userId (FK: users)
├── action (ENUM: CREATE, UPDATE, DELETE, VIEW, EXPORT, SEND_EMAIL)
├── entityType (ENUM: LEAD, CUSTOMER, DEAL, QUOTATION, ORDER, etc.)
├── entityId (String)
├── changes (JSON: {field, oldValue, newValue})
├── ipAddress (String)
├── userAgent (String)
├── createdAt
└── metadata (JSON)
```

### Notifications
```
notifications
├── id (UUID, PK)
├── userId (FK: users)
├── type (ENUM: FOLLOW_UP_REMINDER, TASK_DUE, DEAL_UPDATED, LEAD_ASSIGNED, etc.)
├── title (String)
├── message (String)
├── relatedEntityType (String)
├── relatedEntityId (String)
├── isRead (Boolean)
├── readAt (DateTime, nullable)
├── createdAt
└── metadata (JSON)
```

---

## Complete User Journey

### 1. Lead Generation (SUSPECT Phase)
1. **Lead Source:** Website form, referral, walk-in, cold call, advertisement
2. **Auto-Scoring:** System calculates lead score based on qualification criteria
3. **Assignment:** Lead auto-assigned to sales rep based on territory/availability
4. **Initial Contact:** Task created to contact lead within 24 hours
5. **Status:** NEW → CONTACTED

**Pages Involved:** `/leads/new`, `/leads`, `/dashboard`

---

### 2. Lead Qualification (PROSPECT Phase)
1. **BANT Analysis:** 
   - **B**udget: Does customer have budget?
   - **A**uthority: Can they make decisions?
   - **N**eed: Do they have a pain point?
   - **T**imeline: When do they need solution?
2. **Follow-up Calls/Emails:** Track all interactions with notes
3. **Document Upload:** Customer uploads requirements, RFQ, etc.
4. **Qualification Decision:** Qualify or reject lead
5. **Status:** CONTACTED → QUALIFIED (or REJECTED)

**Pages Involved:** `/leads/:id`, `/follow-ups`, `/tasks`, `/documents`

---

### 3. Initial Approach (APPROACH Phase)
1. **Create Customer Record:** Register company in master
2. **Add Contact Persons:** Multiple contacts per customer
3. **Create Deal:** Link lead to sales deal
4. **Kick-off Meeting:** Schedule initial discussion meeting
5. **Discovery Call:** Understand business requirements in detail
6. **Next Steps:** Define proposal timeline

**Pages Involved:** `/customers/new`, `/customers/:id`, `/pipeline`, `/calendar`

---

### 4. Negotiation (NEGOTIATION Phase)
1. **Product Selection:** Choose products/services
2. **Pricing & Quotes:** Create quotation with pricing and taxes
3. **Approval Workflow:** Internal approval of quotation
4. **Send Quotation:** Email quotation to customer (PDF attached)
5. **Discussion & Revisions:** Customer feedback and quote revisions
6. **Negotiation Notes:** Track all discussions and agreements
7. **Budget Approval:** Customer secures budget and approves

**Pages Involved:** `/quotations/new`, `/quotations/:id`, `/follow-ups`, `/deals`

---

### 5. Closure (CLOSURE Phase)
1. **PO Receipt:** Customer sends Purchase Order
2. **Order Confirmation:** Create order in system from PO
3. **Inventory Check:** Verify stock availability
4. **Procurement:** Arrange missing items from vendors
5. **Order Fulfillment:** Pick, pack, and prepare shipment
6. **Delivery:** Track shipment and delivery
7. **Invoice:** Generate and send invoice
8. **Payment Receipt:** Record payment (one-time or installments)
9. **Deal Closure:** Mark deal as WON
10. **Post-Sales Handover:** Transfer to support team

**Pages Involved:** `/orders/new`, `/orders/:id`, `/inventory`, `/payments`

---

### 6. Post-Sales Support (ONGOING Phase)
1. **Installation & Commissioning:** Track installation timeline
2. **Training:** Schedule and conduct customer training
3. **Support Tickets:** Customer can log support tickets
4. **SLA Tracking:** Ensure timely resolution
5. **Warranty Management:** Track warranty period and expiry
6. **Periodic Check-ins:** Relationship nurturing calls
7. **Upsell Opportunities:** Identify additional product needs
8. **Contract Renewal:** Manage renewal negotiations
9. **Customer Satisfaction:** Track satisfaction ratings

**Pages Involved:** `/support/tickets`, `/follow-ups`, `/calendar`, `/reports`

---

## Key Features by Module

### Dashboard
- **Real-time KPI Cards:**
  - Total Leads (current month)
  - Conversion Rate (%)
  - Monthly Revenue (₹)
  - Pending Tasks
  - Open Support Tickets

- **Pipeline Overview:** Stage distribution (5 SPANCO stages)
- **Revenue Chart:** 6-month trend
- **Lead Source Distribution:** Pie chart
- **Top Performers:** Leaderboard (sales, new leads, deals closed)
- **Recent Activity Feed:** Last 10 activities (real-time with Socket.io)
- **My Tasks:** Upcoming tasks (due in 7 days)
- **Quick Actions:** New lead, new customer, new quotation

### Lead Management
- **Lead List with Filters:**
  - Search by name, company, email
  - Filter by source, status, score range, assigned rep
  - Sort by creation date, score, next follow-up
  - Bulk actions (assign, mark qualified, delete)

- **Lead Scoring Algorithm:**
  - Company size (+15 if >100 employees)
  - Industry match (+20 if priority industry)
  - Response time (+10 if responded within 24h)
  - Engagement level (+25 if multiple interactions)
  - Budget indication (+30 if mentioned budget)
  - Timeline urgency (+20 if timeline ≤3 months)
  - Total: 0-100 scale

- **Lead Import/Export:**
  - Bulk import from CSV
  - Export filtered leads
  - Validation and duplicate detection

- **Lead Timeline:** Chronological view of all interactions

### Customer Master
- **Company Information:**
  - Company name, GST, industry, website
  - Annual revenue, year established
  - Billing and shipping addresses
  - Customer category (Prospect, Active, Inactive, Lost)

- **Contact Management:**
  - Multiple contact persons per company
  - Contact designation, email, phone
  - Mark primary contact

- **Customer Dashboard:**
  - Total deals (active, won, lost)
  - Total revenue (YTD)
  - Last interaction date
  - Next follow-up scheduled
  - Customer timeline (all interactions)

### Sales Pipeline
- **Kanban Board View:**
  - 5 columns: SUSPECT, PROSPECT, APPROACH, NEGOTIATION, CLOSURE
  - Each card shows: company name, deal value, probability, next action
  - Drag-drop to change stage
  - Click card for detail modal

- **Deal Metrics:**
  - Deal value, expected close date
  - Win probability, next action
  - Assigned owner, last updated
  - Complete history and notes

- **Filtering & Grouping:**
  - Filter by owner, expected close month, value range
  - Group by owner or close date

### Follow-ups & Tasks
- **Follow-up Scheduler:**
  - Calendar view with color-coded interactions
  - Create follow-up: type (call/email/meeting), date, notes
  - Automatic reminders (email/SMS 30 min before)
  - Outcome tracking (completed, rescheduled)

- **Task Management:**
  - Kanban board: TODO, IN_PROGRESS, DONE, CANCELLED
  - Task cards show: title, priority, due date, assignee
  - Create task from follow-up, deal, or standalone
  - Bulk edit (change assignee, priority)

- **Calendar Integration:**
  - Month view with events
  - Sync with Google Calendar/Outlook
  - Conflict detection for assignments

### Quotation Engine
- **Quotation Creation:**
  - Customer selection (auto-populate company details)
  - Product selection with quantity, unit price
  - Automatic tax calculation (GST %)
  - Add line-item discounts
  - Add general notes and terms

- **Pricing Rules:**
  - Base product price from inventory
  - Volume discounts (if configured)
  - Customer-specific pricing (if configured)
  - Currency selection (₹, $, €)

- **Approval Workflow:**
  - Draft quotation
  - Submit for approval
  - Manager approval/rejection with comments
  - Once approved, quotation locked

- **PDF Generation & Distribution:**
  - Auto-generate professional PDF
  - Email to customer
  - Track email open/download (optional: with tracking pixel)
  - Track quotation expiry

- **Versioning:**
  - Track quotation revisions
  - Show change history (items added/removed, price changes)
  - Compare versions

### Order Management
- **Order Creation:**
  - Link to quotation (auto-populate items, prices)
  - PO number and PO date (from customer)
  - Delivery date expected
  - Special delivery instructions

- **Order Fulfillment:**
  - Check inventory availability
  - Initiate procurement for missing items (from vendors)
  - Track inventory allocation
  - Generate picking list
  - Create shipment and track delivery

- **Payment Tracking:**
  - Payment status (pending, partial, completed)
  - Invoice generation and delivery
  - Payment installment tracking
  - Overdue payment alerts

- **Order Timeline:**
  - Stages: Pending → Confirmed → Fulfilled → Invoiced → Completed
  - Track date for each milestone

### Inventory Management
- **Product Catalog:**
  - SKU, product name, category
  - Base price, tax %, description
  - Stock quantity, reorder level
  - Warehouse location
  - Active/inactive status

- **Stock Monitoring:**
  - Real-time stock levels
  - Low stock alerts
  - Reorder recommendations
  - Stock movement history

- **Vendor Management:**
  - Vendor master (name, GST, contact, payment terms)
  - Vendor rating and performance
  - Product availability by vendor
  - Vendor pricing and lead time
  - Procurement request to vendor

### Support Ticketing
- **Ticket Creation:**
  - Customer can self-log tickets (via portal or email)
  - System auto-creates from email forwards
  - Type (technical, billing, general)
  - Priority level (low, medium, high, urgent)

- **Ticket Workflow:**
  - Auto-assignment based on category/skill
  - Status flow: OPEN → IN_PROGRESS → RESOLVED → CLOSED
  - SLA tracking (response time, resolution time)
  - Escalation if SLA breached

- **Resolution:**
  - Support notes and updates
  - Knowledge base article linking
  - File attachments
  - Customer satisfaction rating

- **Analytics:**
  - Ticket volume by type, priority
  - Average resolution time
  - Ticket source (phone, email, portal)
  - CSAT trend

### Reports & Analytics
- **Pre-built Reports:**
  1. **Sales Dashboard:** Pipeline value by stage, win rate, average deal size
  2. **Revenue Report:** Monthly revenue trend, revenue by customer, product performance
  3. **Lead Report:** Lead source distribution, conversion rate, cost per lead
  4. **Team Performance:** Sales rep metrics, target vs. actual, individual KPIs
  5. **Customer Report:** Customer list, revenue per customer, interaction frequency
  6. **Support Report:** Ticket volume, resolution time, CSAT trends
  7. **Inventory Report:** Stock levels, aging, reorder recommendations
  8. **Forecast:** Pipeline forecast, probability-weighted pipeline

- **Custom Report Builder:**
  - Drag-drop fields to create custom reports
  - Filters and grouping options
  - Save and schedule reports (daily/weekly/monthly email)

- **Data Export:**
  - CSV, Excel, PDF formats
  - Large dataset export (async download)

- **Dashboards:**
  - Real-time updates
  - Drill-down capability
  - Drill-down capability
  - Saved dashboard views
  - Share dashboards with team

### Settings & Administration
- **Company Settings:**
  - Company name, logo, address
  - Tax settings (GST %)
  - Financial year settings
  - Default currency and timezone
  - Email configuration (SMTP for notifications)

- **User Management:**
  - User create, edit, deactivate
  - Role assignment (ADMIN, SALES_MANAGER, SALES_EXEC, SUPPORT, VIEWER)
  - Permission matrix (create, read, update, delete per entity)
  - Department and territory assignment
  - Password reset and MFA setup

- **RBAC (Role-Based Access Control):**
  - Role definitions with granular permissions
  - Custom role creation
  - Permission hierarchy

- **Integrations:**
  - Email integration (Gmail, Outlook, custom SMTP)
  - WhatsApp Business API (for messaging)
  - Calendar sync (Google Calendar, Outlook)
  - API keys for custom integrations
  - Webhook configuration

- **Data & Backup:**
  - Manual data export
  - Automatic daily backups
  - Data retention policy
  - GDPR compliance (right to be forgotten)

---

## Security & Compliance

### Authentication & Authorization
- **JWT-based authentication** with refresh tokens
- **Password hashing** (bcrypt, min 12 characters)
- **Multi-factor authentication (MFA)** optional for admins
- **Role-based access control (RBAC)** with granular permissions
- **Audit logging** of all user actions

### Data Security
- **Encryption at rest** (database encryption)
- **Encryption in transit** (HTTPS/TLS)
- **PII handling** (GST, email, phone - encrypted)
- **Data retention policy** (configurable deletion)
- **GDPR compliance** (export, deletion, consent tracking)

### Compliance
- **GST handling** for Indian tax compliance
- **Activity audit trail** for all changes
- **Document retention** for compliance (7+ years)

---

## UI/UX Guidelines

### Color Scheme
- **Primary:** Blue (#0066CC)
- **Success:** Green (#00AA44)
- **Warning:** Orange (#FF9900)
- **Error:** Red (#CC0000)
- **Neutral:** Gray (#666666)

### Component Library
- Use **ShadCN UI** for consistent design
- **DataTable** component for lists
- **Modal** for detail views and confirmations
- **Toast** for notifications (Sonner library)
- **Kanban board** using @dnd-kit

### Typography
- **Headers:** Inter (sans-serif), bold
- **Body:** Inter (sans-serif), regular
- **Monospace:** Courier New (for codes, SKUs)

### Responsive Design
- **Desktop:** Full layout (1920px+)
- **Tablet:** Responsive grid (768-1024px)
- **Mobile:** Stack layout (< 768px) - limited features

---

## Performance & Scalability

### Database Optimization
- **Indexing:** Indexes on foreign keys, status, assignedTo
- **Query optimization:** Pagination (20-50 items per page)
- **Caching:** Redis for frequently accessed data (product catalog, user list)

### Frontend Performance
- **Code splitting:** Route-based and component-based splitting
- **Lazy loading:** Images, modals, route components
- **Bundle size:** Target <150KB gzipped per route

### Real-time Updates
- **Socket.io** for live notifications and data updates
- **Throttled updates** (1-5 second debounce for real-time data)

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- Project setup, database schema, authentication
- Dashboard with basic KPIs
- Lead management (CRUD, list)

### Phase 2: Core Sales Flow (Week 3-4)
- Customer master, sales pipeline, quotations
- Follow-up and task management
- Basic notifications

### Phase 3: Operations (Week 5-6)
- Inventory and vendor management
- Order management, payment tracking
- Document management

### Phase 4: Support & Analytics (Week 7-8)
- Support ticketing system
- Reports and analytics
- Integrations (email, calendar)

### Phase 5: Polish & Deployment (Week 9-10)
- UI refinements, testing
- Performance optimization
- Security hardening, deployment

---

## Development Guidelines

### Code Organization
```
/app
  /(auth)          # Authentication pages
  /(dashboard)     # Main app pages
    /leads
    /customers
    /pipeline
    /quotations
    /orders
    /support
    /reports
    /settings
/components
  /ui              # ShadCN components
  /forms           # Form components
  /tables          # Data table components
  /modals          # Modal components
/lib
  /api             # API client functions
  /db              # Database utilities
  /auth            # Auth utilities
  /utils           # Helper functions
/prisma
  /schema.prisma   # Database schema
  /migrations      # Database migrations
/public            # Static files
```

### Naming Conventions
- **Files:** kebab-case (e.g., `lead-list.tsx`)
- **Components:** PascalCase (e.g., `LeadList`)
- **Functions:** camelCase (e.g., `fetchLeads()`)
- **Database fields:** snake_case (e.g., `created_at`)
- **API routes:** kebab-case (e.g., `/api/leads`)

### Git Workflow
- **Branch naming:** `feature/module-name`, `bugfix/issue-desc`, `release/v1.0`
- **Commits:** Descriptive, present tense (e.g., "Add lead scoring logic")
- **PRs:** Link to issues, include test results

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Reset password

### Leads
- `GET /api/leads` - List leads
- `POST /api/leads` - Create lead
- `GET /api/leads/:id` - Get lead detail
- `PATCH /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

### Customers
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `GET /api/customers/:id` - Get customer detail
- `PATCH /api/customers/:id` - Update customer

### Deals
- `GET /api/deals` - List deals (grouped by stage)
- `POST /api/deals` - Create deal
- `PATCH /api/deals/:id/stage` - Move deal to stage
- `GET /api/deals/:id` - Get deal detail

### Quotations
- `GET /api/quotations` - List quotations
- `POST /api/quotations` - Create quotation (generates PDF)
- `GET /api/quotations/:id` - Get quotation detail
- `PATCH /api/quotations/:id` - Update quotation
- `POST /api/quotations/:id/send` - Send quotation email
- `PATCH /api/quotations/:id/approve` - Approve quotation

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order detail
- `PATCH /api/orders/:id/delivery` - Update delivery status
- `PATCH /api/orders/:id/payment` - Record payment

### Follow-ups
- `GET /api/follow-ups` - List follow-ups
- `POST /api/follow-ups` - Create follow-up
- `PATCH /api/follow-ups/:id` - Update follow-up
- `POST /api/follow-ups/:id/complete` - Mark as completed

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete task

### Reports
- `GET /api/reports/sales-dashboard` - Sales dashboard data
- `GET /api/reports/revenue` - Revenue report
- `GET /api/reports/lead-conversion` - Lead conversion report
- `POST /api/reports/export` - Export report as CSV/PDF

### Support
- `GET /api/tickets` - List support tickets
- `POST /api/tickets` - Create ticket
- `PATCH /api/tickets/:id` - Update ticket
- `POST /api/tickets/:id/resolve` - Mark as resolved

### Inventory
- `GET /api/products` - List products
- `GET /api/inventory` - Get stock levels
- `PATCH /api/inventory/:productId` - Update stock

### Vendors
- `GET /api/vendors` - List vendors
- `POST /api/vendors` - Create vendor
- `GET /api/vendors/:id/products` - Products from vendor

---

## Support & Troubleshooting

### For Development Issues
- Check database connection: `npm run db:validate`
- Reset database: `npm run db:reset`
- Check API logs: `tail -f logs/api.log`

### Common Issues
- **"Database connection refused"** → Ensure PostgreSQL is running
- **"Token expired"** → Check JWT_SECRET in .env
- **"Quotation PDF generation failed"** → Ensure PDFKit is installed

---

**Last Updated:** 2026-05-25
**Maintained By:** Engineering Team
