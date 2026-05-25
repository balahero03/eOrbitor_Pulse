# eOrbitor Pulse - Quick Start Guide

## 🚀 Running the Project (5 Minutes)

### Prerequisites Checklist
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] PostgreSQL 15+ running locally
- [ ] PostgreSQL user/password ready

---

## Step-by-Step Instructions

### 1. Clone/Navigate to Project
```bash
cd /home/balahero03/eOrbitor_Pulse
```

### 2. Install Dependencies
```bash
npm install
```
**Time:** ~2-3 minutes (downloads all packages)

### 3. Configure Environment

Copy the example environment file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your PostgreSQL credentials:
```bash
# Open in your editor
nano .env.local
```

Update these variables:
```
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/eorbitor_pulse"
JWT_SECRET="generate-any-random-string-here"
SESSION_SECRET="generate-another-random-string-here"
NODE_ENV="development"
PORT=3000
```

**Replace:**
- `YOUR_USER` - PostgreSQL username (default: `postgres`)
- `YOUR_PASSWORD` - PostgreSQL password
- `eorbitor_pulse` - Database name (will be created automatically)

### 4. Create Database & Setup Schema

Generate Prisma client:
```bash
npm run prisma:generate
```

Create database schema:
```bash
npm run db:push
```

Seed with initial data (admin user, test data):
```bash
npm run db:seed
```

✅ Database is now ready!

### 5. Start Development Server
```bash
npm run dev
```

You should see:
```
> eOrbitor_Pulse@1.0.0 dev
> next dev

  ▲ Next.js 14.x
  - Local:        http://localhost:3000
  - Environments: .env.local

ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### 6. Open in Browser

Visit: **http://localhost:3000**

You'll see the login page.

---

## 🔑 Login Credentials

### Admin User (Full Access)
```
Email:    admin@company.local
Password: password
```

### Sales Executive User (Test)
```
Email:    sales@company.local
Password: password
```

---

## 📱 Explore the Application

After login, you can access:

### Main Modules
- **Dashboard** - KPI cards and quick stats
- **Leads** - Lead management and scoring
- **Customers** - Customer master data
- **Pipeline** - Kanban sales board
- **Quotations** - Quote creation and approval
- **Orders** - Order management and tracking
- **Tasks** - Task assignments and follow-ups
- **Support** - Support ticket management
- **Reports** - Analytics and dashboards
- **Settings** - User management and admin

### Quick Demo Flow
1. Go to **Leads** → Create a test lead
2. Go to **Customers** → Create a test customer
3. Go to **Pipeline** → View the Kanban board
4. Go to **Orders** → Create an order
5. Go to **Reports** → View analytics

---

## 🛑 Stopping the Server

Press `Ctrl + C` in your terminal to stop the development server.

---

## 🔧 Available NPM Commands

```bash
# Development
npm run dev              # Start development server (http://localhost:3000)

# Database
npm run prisma:generate # Generate Prisma client
npm run db:push         # Sync schema with database
npm run db:seed         # Populate with seed data

# Production
npm run build           # Build for production
npm run start           # Start production server

# Utilities
npm run lint            # Run linting
npm run type-check      # Check TypeScript types
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to PostgreSQL"
**Solution:**
1. Verify PostgreSQL is running: `psql --version`
2. Check database URL in `.env.local`
3. Verify PostgreSQL user and password are correct
4. Test connection: `psql -h localhost -U postgres`

### Issue: "Port 3000 already in use"
**Solution:**
```bash
# Kill the process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### Issue: "Prisma Client not found"
**Solution:**
```bash
npm run prisma:generate
npm install
```

### Issue: "Database doesn't exist"
**Solution:**
The database will be created automatically when you run:
```bash
npm run db:push
```

If it fails, create manually:
```bash
psql -U postgres -c "CREATE DATABASE eorbitor_pulse;"
```

### Issue: "Cannot find module"
**Solution:**
```bash
npm install
npm run prisma:generate
```

---

## 📊 What's Included?

This project comes with:
- ✅ 10 complete CRM modules
- ✅ 57+ API endpoints
- ✅ 40 interactive pages
- ✅ Sample data (leads, customers, deals, etc.)
- ✅ Admin user for testing
- ✅ Full documentation

---

## 📚 Next Steps

Once the app is running:

1. **Read the documentation:**
   - `PROJECT_SPEC.md` - Feature overview
   - `IMPLEMENTATION_STATUS.md` - What's implemented

2. **Explore each module:**
   - Create sample data
   - Test workflows
   - Review analytics

3. **Customize:**
   - Change branding (logo, colors)
   - Add custom fields
   - Extend API endpoints

4. **Deploy to production:**
   - See `SETUP.md` for production deployment
   - Configure PostgreSQL backups
   - Set up PM2 and Nginx

---

## 🆘 Need Help?

- **Setup issues?** → Check `SETUP.md`
- **Feature questions?** → Check `PROJECT_SPEC.md`
- **What's implemented?** → Check `IMPLEMENTATION_STATUS.md`
- **Module details?** → Check `PHASE1-10_SUMMARY.txt` files

---

## ✅ Quick Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 15+ running
- [ ] `npm install` completed
- [ ] `.env.local` configured with database URL
- [ ] `npm run db:push` completed
- [ ] `npm run db:seed` completed
- [ ] `npm run dev` started
- [ ] http://localhost:3000 opens in browser
- [ ] Can login with admin@company.local / password
- [ ] See dashboard with KPI cards

**That's it! Your eOrbitor Pulse CRM is running! 🎉**

---

## 💾 Default Database

The seed script creates:
- **Admin User** (admin@company.local)
- **Test Users** (sales@company.local)
- **Sample Leads** (5 leads in different stages)
- **Sample Customers** (5 companies)
- **Sample Deals** (10 deals in pipeline)
- **Sample Products** (20 products for inventory)
- **Sample Vendors** (5 vendors)

---

**Happy selling! 🚀**
