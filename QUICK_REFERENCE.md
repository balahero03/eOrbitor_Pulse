# 🚀 Quick Reference - Sales Reports System

## 📋 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Sales Exec | john@example.com | password123 |
| Manager | jane@example.com | password123 |
| Admin | admin@example.com | admin123 |

## 🔗 URLs

| Page | URL |
|------|-----|
| Login | http://localhost:3000/login |
| Dashboard | http://localhost:3000/dashboard |
| Reports | http://localhost:3000/reports |

## 📊 Available Reports

1. **Personal Performance** - Your metrics & performance
2. **Team Performance** - Team leaderboard & rankings
3. **Pipeline Health** - Deal stages & forecast

## 📈 Metrics Calculated

- Win Rate (%)
- Revenue Generated
- Total Leads
- Average Deal Value
- Sales Cycle Duration
- Activities Performed
- Conversion Rate
- Performance Score (0-100)
- Team Rankings

## 🎯 How to Generate a Report

1. Login with test credentials
2. Dashboard → Reports
3. Select report type
4. Pick date range
5. Click "Generate Report"
6. View charts and tables

## 🛠️ API Endpoints

```
GET /api/reports/personal?startDate=...&endDate=...
GET /api/reports/team?managerId=...&startDate=...&endDate=...
GET /api/reports/pipeline?startDate=...&endDate=...
GET /api/reports/recent
```

Add header: `Authorization: Bearer <token>`

## 💾 Database

- **Name**: eorbitor_pulse
- **Type**: PostgreSQL
- **Host**: localhost:5432
- **Status**: Running ✅

## 📁 Key Files

| File | Purpose |
|------|---------|
| `lib/reports/calculator.ts` | Metric calculations |
| `app/api/reports/*` | API endpoints |
| `app/(dashboard)/reports/*` | Frontend pages |
| `prisma/schema.prisma` | Database models |

## 🔐 Auth Header Format

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📊 Chart Types in Reports

- **Line Chart**: Revenue over time
- **Pie Chart**: Revenue by source
- **Bar Chart**: Leads by status
- **Progress Bars**: Performance breakdown

## ⚡ Performance

- Real-time calculations
- Database-level aggregations
- Cached reports (24-hour TTL)
- Optimized queries

## ✅ Features

✓ Real-time metrics
✓ Multiple date ranges
✓ Professional visualizations
✓ Team leaderboards
✓ Role-based access
✓ Responsive design
✓ Mobile friendly

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't login | Check email/password in table above |
| No data in report | Add leads/deals to database first |
| API error | Check Authorization header |
| Charts not showing | Clear browser cache |

## 📖 Full Documentation

- `IMPLEMENTATION_COMPLETE.md` - Complete overview
- `REPORTS_SETUP_GUIDE.md` - Detailed setup
- `LOGIN_CREDENTIALS.md` - User management

## 🎓 Example API Call

```bash
# Get personal report
curl -X GET "http://localhost:3000/api/reports/personal?startDate=2026-01-01&endDate=2026-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📱 Responsive Design

✓ Works on mobile
✓ Works on tablet
✓ Works on desktop
✓ Print-friendly

## 🔄 Workflow

```
Login → Dashboard → Reports → Select Type → Pick Date → Generate → View → Print
```

---

**Everything is ready to use!** 🎉

Start with: http://localhost:3000/login
