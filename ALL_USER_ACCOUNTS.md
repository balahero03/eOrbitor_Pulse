# 👥 Complete User Accounts Guide

## System User Accounts

### 🔴 **SUPER_ADMIN** - Full System Access

#### Account 1: Super Admin (Master Account)
```
Email:    superadmin@eorbitor.com
Password: SuperAdmin@123
Name:     Super Admin
Role:     SUPER_ADMIN
Status:   ✅ ACTIVE
```

**Can Do**:
- Access all features
- Manage all users
- Create/edit/delete announcements
- View all reports
- Manage system settings
- Approve/reject requests
- Access admin panel

---

### 🟢 **ADMIN** - Admin Access

#### Account 1: Admin (Primary)
```
Email:    admin@example.com
Password: admin123
Name:     Admin User
Role:     ADMIN
Status:   ✅ ACTIVE
```

#### Account 2: Admin (Company)
```
Email:    admin@company.local
Password: password123
Name:     Admin User
Role:     ADMIN
Status:   ✅ ACTIVE
```

**Can Do**:
- Manage users
- Create announcements
- View all reports
- Access settings
- Manage approvals

---

### 🔵 **SALES_MANAGER** - Team Manager

#### Account: Sales Manager
```
Email:    jane@example.com
Password: password123
Name:     Jane Smith
Role:     SALES_MANAGER
Status:   ✅ ACTIVE
```

**Can Do**:
- View own personal reports
- View team member reports
- Manage team members
- Create/manage tasks
- Track team pipeline
- View approvals

---

### 🟡 **SALES_EXEC** - Sales Executive

#### Account 1: John (Sales)
```
Email:    john@example.com
Password: password123
Name:     John Doe
Role:     SALES_EXEC
Status:   ✅ ACTIVE
```

#### Account 2: Sales (Company)
```
Email:    sales@company.local
Password: password123
Name:     John Sales
Role:     SALES_EXEC
Status:   ✅ ACTIVE
```

**Can Do**:
- Create/manage own leads
- Track own deals
- Create tasks
- View own reports
- Log activities
- Follow up on opportunities

---

## 📊 Quick Comparison

| Feature | Super Admin | Admin | Manager | Sales Exec |
|---------|-----------|-------|---------|-----------|
| View All Reports | ✅ | ✅ | ✅ | Own only |
| Manage Users | ✅ | ✅ | - | - |
| Create Leads | ✅ | - | ✅ | ✅ |
| Approve Requests | ✅ | ✅ | - | - |
| System Settings | ✅ | ✅ | - | - |
| View Announcements | ✅ | ✅ | ✅ | ✅ |
| Create Announcements | ✅ | ✅ | - | - |
| Team Reports | ✅ | ✅ | ✅ | - |
| Personal Reports | ✅ | ✅ | ✅ | ✅ |

---

## 🎯 Recommended Usage

### For Testing

**Super Admin Account** (Recommended for testing):
```
superadmin@eorbitor.com / SuperAdmin@123
```
- Access everything
- Test all features
- Manage users

**Sales Exec Account** (For user testing):
```
john@example.com / password123
```
- Test lead creation
- Test report generation
- Test regular user workflow

**Sales Manager Account** (For team testing):
```
jane@example.com / password123
```
- Test team management
- Test team reports
- Test manager features

---

## 🚀 Quick Start

### Login
1. Go to: http://localhost:3000/login
2. Enter email and password from above
3. Click Login

### What Each Role Can Do

**As Super Admin**:
- Access Reports → Generate personal/team/pipeline reports
- Go to Users → Manage all user accounts
- Go to Announcements → Create system messages
- Go to Settings → Configure system

**As Sales Manager**:
- Access Reports → View team reports
- Create Leads → Add new opportunities
- View Orders → Track pipeline
- Create Tasks → Assign to team

**As Sales Exec**:
- Create Leads → Build your pipeline
- View Reports → Check personal metrics
- Create Tasks → Track your work
- Follow-ups → Schedule reminders

---

## 📝 Account Management

### Verify All Accounts
```bash
DATABASE_URL="postgresql://..." node scripts/check-database.js
```

### Verify Super Admin
```bash
DATABASE_URL="postgresql://..." node scripts/verify-super-admin.js
```

### Create New User (As Super Admin)
1. Login as Super Admin
2. Navigate to Users
3. Click "Add New User"
4. Fill in details
5. Save

Or create via script:
```bash
# Create script in scripts/ directory
```

---

## 🔐 Password Management

All passwords are:
- ✅ Hashed with bcrypt
- ✅ Secure and encrypted
- ✅ Never stored in plain text
- ✅ Changed via user settings

### Change Your Password
1. Login
2. Click Profile (top right)
3. Go to Settings
4. Change Password
5. Save

---

## 📊 Feature Access Matrix

### Reports
- **Super Admin**: All reports, all users
- **Admin**: All reports, all users
- **Manager**: Own + team reports
- **Sales Exec**: Own reports only

### User Management
- **Super Admin**: Create/edit/delete all
- **Admin**: Create/edit (not delete)
- **Manager**: View team only
- **Sales Exec**: View own only

### Leads & Deals
- **Super Admin**: View all, manage all
- **Admin**: View all, approve deletions
- **Manager**: Own + team
- **Sales Exec**: Own only

### System Settings
- **Super Admin**: Full access
- **Admin**: Limited access
- **Manager**: No access
- **Sales Exec**: No access

---

## ✅ Verification Checklist

Before using accounts, verify:

- [ ] Database is running
- [ ] All 6 user accounts exist
- [ ] Super admin account is active
- [ ] Can login with superadmin@eorbitor.com
- [ ] Reports page is accessible
- [ ] Dashboard loads correctly

---

## 🎓 Common Tasks by Role

### Super Admin Tasks
- Create new user accounts
- Reset user passwords
- Create system announcements
- View all reports
- Manage system settings
- Approve/reject requests

### Admin Tasks
- Help users with issues
- View activity logs
- Create announcements
- Manage approvals
- Monitor system health

### Manager Tasks
- Track team performance
- View team reports
- Manage team members
- Assign leads/deals
- Create team tasks

### Sales Exec Tasks
- Create and qualify leads
- Track deals in pipeline
- Log follow-ups
- Update deal status
- View personal metrics

---

## 📞 Need to Reset?

If you need to reset any account:

```bash
# Recreate super admin (with same credentials)
DATABASE_URL="postgresql://..." node scripts/create-super-admin.js

# Recreate test users
DATABASE_URL="postgresql://..." node scripts/create-test-user.js
```

---

## 🎉 You're Ready!

All user accounts are set up and ready to use.

**Start with**: `superadmin@eorbitor.com / SuperAdmin@123`

Login here: http://localhost:3000/login

---

**Status**: ✅ All Accounts Active
**Total Users**: 6
**Super Admin**: 1
**Admins**: 2
**Managers**: 1
**Sales Execs**: 2
