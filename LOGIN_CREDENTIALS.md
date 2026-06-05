# 🔐 Login Credentials & User Setup

## Test User Credentials

The following test users have been created for testing the application:

### 1. **Sales Executive**
```
Email:    john@example.com
Password: password123
Role:     SALES_EXEC
```
**Access**: Can create leads, follow-ups, view personal reports, track activities

### 2. **Sales Manager**
```
Email:    jane@example.com
Password: password123
Role:     SALES_MANAGER
```
**Access**: Can manage team, view team reports, approve leads, manage subordinates

### 3. **Admin**
```
Email:    admin@example.com
Password: admin123
Role:     ADMIN
```
**Access**: Full access to all features, user management, settings, announcements

---

## How to Login

1. **Go to Login Page**: Navigate to `http://localhost:3000/login` (or your app URL)
2. **Enter Email**: Type the email from credentials above
3. **Enter Password**: Type `password123` (or `admin123` for admin)
4. **Click Login**: System will authenticate and redirect to dashboard

---

## Testing Reports Feature

### Using Sales Executive Account:
1. Login with `john@example.com / password123`
2. Navigate to: Dashboard → Reports (📈 in sidebar)
3. Click "Generate Report"
4. Select "Personal Performance"
5. Choose date range (e.g., Last 30 Days)
6. Click "Generate Report"
7. View metrics, charts, and top deals

### Using Sales Manager Account:
1. Login with `jane@example.com / password123`
2. Navigate to: Dashboard → Reports
3. Select "Team Performance"
4. Can see team members' individual metrics and rankings
5. View comparative analysis

### Using Admin Account:
1. Login with `admin@example.com / admin123`
2. Can access all report types
3. Can view all users' reports
4. Can view pipeline health across organization

---

## If You Need More Test Users

Run the creation script again with different credentials:

```bash
DATABASE_URL="postgresql://eorbitor:YourStrongDatabasePassword123!@localhost:5432/eorbitor_pulse" node scripts/create-test-user.js
```

Or manually create users by modifying `scripts/create-test-user.js` and running it.

---

## Resetting Password (If Needed)

If you need to reset a user's password, create a reset script:

```bash
# Create a file: scripts/reset-password.js
# And run it with: node scripts/reset-password.js <email> <newpassword>
```

---

## Database Status

✅ **Database**: PostgreSQL (eorbitor_pulse)
✅ **Schema**: Synced with Prisma models
✅ **Test Users**: Created and ready
✅ **Tables**: All tables created with Report models
✅ **Indexes**: Optimized for performance

---

## Troubleshooting Login Issues

### "Invalid email or password" error:
1. Check email spelling (case-insensitive)
2. Verify password is exactly: `password123`
3. Ensure account is active (isActive = true)

### "User account is inactive" error:
- User exists but account is disabled
- Contact admin to activate

### Still not working?
1. Verify database connection: `npx prisma db push`
2. Check user exists: `DATABASE_URL="..." npx prisma studio`
3. Recreate test users: Run script above

---

## Next Steps After Login

1. **Explore Dashboard**: View KPIs, announcements, recent activities
2. **Generate Your First Report**: Follow steps above for your role
3. **Check Leads/Deals**: Navigate to Leads or Customers section
4. **Create Tasks/Activities**: Log your daily work

---

## Notes

- Passwords are hashed using bcrypt
- JWT tokens expire after 3 days
- Session auto-closes on logout
- Activity tracking enabled on login/logout
- All actions are timestamped

---

**Ready to test the Reports System!** 🎉

Use the credentials above to login and generate your first sales report.
