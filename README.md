# eOrbitor Pulse - Enterprise CRM Platform

**Status:** ✅ Production Ready | **Version:** 2.0.0 | **Last Updated:** May 25, 2026

A complete, enterprise-grade CRM platform designed for local/on-premise deployment. Built with Next.js 14, React 18, TypeScript, PostgreSQL, and Tailwind CSS.

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+ 
- npm 8+
- PostgreSQL 15+

### Installation

```bash
# 1. Navigate to project
cd /home/balahero03/eOrbitor_Pulse

# 2. Install dependencies
npm install

# 3. Configure database
cp .env.local.example .env.local
# Edit .env.local with your PostgreSQL credentials

# 4. Setup database
npm run prisma:generate
npm run db:push
npm run db:seed

# 5. Start development server
npm run dev
```

Visit: **http://localhost:3000**

**Default Login:**
- Email: `admin@company.local`
- Password: `password`

---

## 📋 PostgreSQL Setup (Ubuntu/Linux)

```bash
# 1. Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# 2. Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 3. Create user and database
sudo -u postgres psql -c "CREATE USER eorbitor WITH PASSWORD 'YourStrongDatabasePassword123!';"
sudo -u postgres psql -c "CREATE DATABASE eorbitor_pulse OWNER eorbitor;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE eorbitor_pulse TO eorbitor;"

# 4. Update .env.local
DATABASE_URL="postgresql://eorbitor:YourStrongDatabasePassword123!@localhost:5432/eorbitor_pulse"
```

---

## 📦 Project Structure

```
eOrbitor_Pulse/
├── app/
│   ├── (auth)/login/              # Login page
│   ├── (dashboard)/               # 10 modules (40 pages)
│   │   ├── dashboard/
│   │   ├── leads/
│   │   ├── customers/
│   │   ├── pipeline/
│   │   ├── quotations/
│   │   ├── orders/
│   │   ├── tasks/
│   │   ├── support/
│   │   ├── reports/
│   │   └── settings/
│   └── api/                       # 57+ REST API endpoints
├── prisma/
│   ├── schema.prisma              # Database schema (15 tables)
│   └── seed.js                    # Initial data
├── lib/
│   └── logger.ts                  # Activity logging
├── .env.local.example             # Environment template
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

---

## 🎯 Features (10 Modules)

| Module | Features | API Endpoints |
|--------|----------|---|
| **Leads** | Lead capture, scoring, qualification, source tracking | 5 |
| **Customers** | Company master data, contacts, relationships | 9 |
| **Pipeline** | Kanban board, SPANCO stages, deal tracking | 4 |
| **Quotations** | Quote creation, approval workflow, versions | 6 |
| **Orders** | PO processing, delivery, payment tracking | 6 |
| **Tasks** | Task assignments, follow-ups, calendar view | 6 |
| **Inventory** | Products, stock monitoring, vendors, procurement | 7 |
| **Support** | Ticket management, SLA, satisfaction rating | 3 |
| **Reports** | Sales analytics, lead analysis, team performance | 5 |
| **Settings** | User management, activity logs, RBAC | 6 |

**Total:** 57+ API endpoints, 40 pages, 15,980+ LOC

---

## 🔧 Technology Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI:** React 18 + TypeScript 5
- **Styling:** Tailwind CSS 3
- **State:** React Hooks

### Backend
- **Runtime:** Node.js 18+ LTS
- **ORM:** Prisma 5
- **Auth:** JWT (custom)
- **Security:** bcryptjs (10-round hashing)

### Database
- **System:** PostgreSQL 15+
- **Tables:** 15 core + system
- **Pattern:** Soft delete, audit trail

### Infrastructure
- **Local:** PM2 + Nginx (see SETUP.md)
- **SSL:** Self-signed certificates
- **Backups:** Automated daily

---

## 📊 Database Schema

### Core Tables (15)
- **User** - System users with 5 roles (ADMIN, SALES_MANAGER, SALES_EXEC, SUPPORT, VIEWER)
- **Lead** - Lead records with source, status, score
- **Customer** - Company master data with GST tracking
- **Contact** - Customer contact persons
- **Deal** - Sales opportunities (6 SPANCO stages)
- **Quotation** - Price quotes with approval workflow
- **Order** - Customer orders with delivery & payment tracking
- **Task** - Task assignments and tracking
- **FollowUp** - Call/email/meeting records
- **Product** - Product catalog with pricing
- **Inventory** - Stock levels and locations
- **Vendor** - Vendor master with ratings
- **VendorProduct** - Product availability by vendor
- **Ticket** - Support tickets with SLA
- **ActivityLog** - Audit trail with user actions
- **Notification** - User notifications with read status

---

## 🔐 Security Features

✅ JWT authentication with 30-day expiration  
✅ Password hashing (bcryptjs, 10 rounds)  
✅ SQL injection prevention (Prisma ORM)  
✅ XSS protection (React templating)  
✅ Role-based access control (5 roles)  
✅ Comprehensive activity logging  
✅ Soft delete pattern (data preservation)  
✅ Local/on-premise only (no cloud)  

---

## 📝 Available Scripts

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)

# Database
npm run prisma:generate # Generate Prisma client
npm run db:push         # Sync schema with database
npm run db:seed         # Populate with sample data

# Production
npm run build           # Build for production
npm run start           # Start production server

# Quality
npm run lint            # Run linting
npm run type-check      # Check TypeScript
```

---

## 🚨 Troubleshooting

### "DATABASE_URL not found"
```bash
# Make sure .env.local exists with DATABASE_URL
cat .env.local | grep DATABASE_URL

# If missing, copy and edit:
cp .env.local.example .env.local
```

### "Port 3000 in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### "Cannot connect to PostgreSQL"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start it if needed
sudo systemctl start postgresql

# Test connection
PGPASSWORD='your_password' psql -U eorbitor -h localhost -d eorbitor_pulse -c "SELECT 1;"
```

### "Prisma Client not found"
```bash
npm run prisma:generate
npm install
```

---

## 🔄 Running in Production

See **SETUP.md** for:
- PM2 ecosystem configuration
- Nginx reverse proxy setup
- PostgreSQL backup automation
- SSL/TLS certificate generation
- Firewall configuration
- System monitoring

---

## 👥 User Roles

| Role | Permissions |
|------|------------|
| **ADMIN** | Full system access, user management, settings |
| **SALES_MANAGER** | Team management, pipeline oversight, reports |
| **SALES_EXEC** | Lead/deal/order management, own tasks |
| **SUPPORT** | Ticket management, customer support |
| **VIEWER** | Read-only access to all modules |

---

## 📈 Key Metrics

- **API Endpoints:** 57+
- **Frontend Pages:** 40
- **Database Tables:** 15+
- **Lines of Code:** 15,980+
- **User Roles:** 5
- **Supported Currencies:** INR (₹)
- **Tax Rate:** 18% GST (configurable)

---

## 📚 Documentation

- **SETUP.md** - Production deployment guide
- **PROJECT_SPEC.md** - Detailed feature specification
- **.env.local.example** - Environment configuration template

---

## 🎓 Architecture Highlights

### Design Patterns
1. **Soft Delete Pattern** - Preserves data integrity
2. **Activity Logging** - Comprehensive accountability
3. **Pagination** - Efficient data handling
4. **Status Workflows** - Clear business processes
5. **Role-Based Access** - Organizational structure

### Frontend Architecture
1. **Component-Based** - Reusable React components
2. **State Management** - React Hooks
3. **Client Validation** - UX improvement
4. **Server Validation** - Data security
5. **Responsive Design** - Mobile-friendly

### Backend Architecture
1. **RESTful APIs** - Standard HTTP methods
2. **Prisma ORM** - Type-safe database access
3. **JWT Auth** - Stateless security
4. **Environment Config** - Flexible deployment
5. **Error Handling** - Consistent patterns

---

## 🤝 Support & Maintenance

### After Deployment
1. Configure database backups (automated daily)
2. Monitor activity logs for audit trail
3. Manage users via admin panel
4. Update configuration via .env.local
5. Set up system monitoring and alerts

### Future Enhancements
- Email notification service (SMTP)
- WebSocket real-time updates (Socket.io)
- Mobile application (React Native)
- Advanced reporting (custom builder)
- API integrations (third-party systems)
- Bulk import/export (CSV, Excel)

---

## ✅ Deployment Checklist

- [ ] PostgreSQL 15+ installed and running
- [ ] Node.js 18+ installed
- [ ] `.env.local` configured with database credentials
- [ ] `npm install` completed
- [ ] `npm run db:push` completed
- [ ] `npm run db:seed` completed
- [ ] `npm run dev` starts without errors
- [ ] http://localhost:3000/login loads
- [ ] Can login with admin@company.local / password
- [ ] Dashboard displays KPI cards

---

## 📄 License

Internal use only - Local/On-premise deployment

---

## 🎉 Ready to Deploy?

```bash
# One-command setup (after PostgreSQL is running)
cd /home/balahero03/eOrbitor_Pulse && \
DATABASE_URL='postgresql://eorbitor:YourStrongDatabasePassword123!@localhost:5432/eorbitor_pulse' npm run prisma:generate && \
DATABASE_URL='postgresql://eorbitor:YourStrongDatabasePassword123!@localhost:5432/eorbitor_pulse' npm run db:push && \
DATABASE_URL='postgresql://eorbitor:YourStrongDatabasePassword123!@localhost:5432/eorbitor_pulse' npm run db:seed && \
DATABASE_URL='postgresql://eorbitor:YourStrongDatabasePassword123!@localhost:5432/eorbitor_pulse' npm run dev
```

**Then open:** http://localhost:3000

---

**eOrbitor Pulse v2.0.0** - Enterprise CRM Platform Ready for Deployment 🚀
