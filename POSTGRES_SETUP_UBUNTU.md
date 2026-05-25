# PostgreSQL Setup Guide for Ubuntu

## Step 1: Install PostgreSQL

```bash
# Update package manager
sudo apt-get update

# Install PostgreSQL and PostgreSQL contrib
sudo apt-get install -y postgresql postgresql-contrib

# Verify installation
psql --version
```

Expected output: `psql (PostgreSQL) 15.x` (or higher)

---

## Step 2: Start PostgreSQL Service

```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Enable PostgreSQL to start on boot
sudo systemctl enable postgresql

# Check if PostgreSQL is running
sudo systemctl status postgresql
```

Expected output: `active (running)` ✅

---

## Step 3: Access PostgreSQL as Default User

```bash
# Switch to postgres user
sudo su - postgres

# You should now see: postgres@yourcomputer:~$
```

---

## Step 4: Change PostgreSQL Password

### Option A: Set a new password (RECOMMENDED)

```bash
# You should be logged in as postgres user (from Step 3)
# If not, run: sudo su - postgres

# Connect to PostgreSQL
psql

# You should now see: postgres=#
```

Now execute these SQL commands:

```sql
-- Change the password for postgres user
ALTER USER postgres WITH PASSWORD 'your_secure_password';

-- Replace 'your_secure_password' with something like:
-- 'PostgreSQL@2026' or 'SecurePass123!'

-- Type \q to exit
\q
```

Example:
```bash
postgres@yourcomputer:~$ psql
psql (15.x)
Type "help" for help.

postgres=# ALTER USER postgres WITH PASSWORD 'PostgreSQL@2026';
ALTER ROLE
postgres=# \q
postgres@yourcomputer:~$
```

---

## Step 5: Exit PostgreSQL User

```bash
# Exit from postgres user back to your regular user
exit

# You should be back to your regular prompt: youruser@yourcomputer:~$
```

---

## Step 6: Test PostgreSQL Connection

```bash
# Test connection with new password
psql -U postgres -h localhost -W

# Type your password when prompted
# If successful, you should see: postgres=#
```

Type `\q` to exit.

---

## Step 7: Create Database for eOrbitor Pulse

```bash
# Connect as postgres user
psql -U postgres -h localhost -W

# Enter your password when prompted
```

Now execute:

```sql
-- Create database for eOrbitor Pulse
CREATE DATABASE eorbitor_pulse;

-- Verify it was created
\l

-- You should see eorbitor_pulse in the list
-- Type \q to exit
\q
```

Example:
```bash
postgres=# CREATE DATABASE eorbitor_pulse;
CREATE DATABASE
postgres=# \l
                                   List of databases
      Name      |  Owner   | Encoding |   Collate    |    Ctype    |   Access privileges
----------------+----------+----------+--------------+-------------+-----------------------
 eorbitor_pulse | postgres | UTF8     | en_US.UTF-8  | en_US.UTF-8 |
 postgres       | postgres | UTF8     | en_US.UTF-8  | en_US.UTF-8 |
 template0      | postgres | UTF8     | en_US.UTF-8  | en_US.UTF-8 | =c/postgres
 template1      | postgres | UTF8     | en_US.UTF-8  | en_US.UTF-8 | =c/postgres
(4 rows)

postgres=# \q
```

---

## Step 8: Configure .env.local File

Now open the eOrbitor Pulse project:

```bash
# Navigate to project directory
cd /home/balahero03/eOrbitor_Pulse

# Edit .env.local
nano .env.local
```

Find the `DATABASE_URL` line and update it:

**Change from:**
```
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/eorbitor_pulse"
```

**Change to:**
```
DATABASE_URL="postgresql://postgres:PostgreSQL@2026@localhost:5432/eorbitor_pulse"
```

Replace `PostgreSQL@2026` with the password you set in Step 4.

**Format breakdown:**
```
DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE"
                          ↑         ↑        ↑     ↑    ↑
                       postgres   your   localhost 5432 eorbitor_pulse
                                password
```

Save the file:
- Press `Ctrl + X`
- Press `Y` (yes)
- Press `Enter`

---

## Step 9: Test Database Connection from Project

```bash
# From project directory
cd /home/balahero03/eOrbitor_Pulse

# Verify .env.local has correct DATABASE_URL
cat .env.local | grep DATABASE_URL

# Should show your updated connection string
```

---

## Step 10: Set Up Database Schema

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed
```

If all succeed ✅, your database is ready!

---

## Step 11: Start the Application

```bash
# From project directory
npm run dev

# Server will start on http://localhost:3000
```

---

## Troubleshooting

### Issue: "FATAL: remaining connection slots are reserved"

```bash
# Stop all connections to the database
sudo systemctl restart postgresql
```

### Issue: "permission denied for schema public"

```bash
# Connect as postgres user
psql -U postgres -h localhost -W

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE eorbitor_pulse TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;

# Type \q to exit
\q
```

### Issue: "role 'postgres' does not exist"

```bash
# Recreate the role
sudo su - postgres
psql

# Inside psql:
CREATE ROLE postgres WITH LOGIN SUPERUSER CREATEDB;
ALTER USER postgres WITH PASSWORD 'your_password';
\q

exit
```

### Issue: "Cannot connect to localhost:5432"

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# If not running, start it
sudo systemctl start postgresql

# Check PostgreSQL is listening on port 5432
sudo netstat -tulpn | grep 5432

# Should show: tcp 0 0 127.0.0.1:5432 0.0.0.0:* LISTEN
```

### Issue: "password authentication failed"

```bash
# Make sure password in .env.local matches the one you set
# To reset password, run as postgres user:

sudo su - postgres
psql

# Inside psql:
ALTER USER postgres WITH PASSWORD 'newpassword';
\q

exit

# Then update .env.local with new password
```

---

## Quick Reference: Common PostgreSQL Commands

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost -W

# Inside psql:
\l                          # List all databases
\c eorbitor_pulse           # Connect to eorbitor_pulse database
\dt                         # List all tables
\du                         # List all users/roles
\q                          # Quit psql

# Create backup
pg_dump -U postgres -h localhost eorbitor_pulse > backup.sql

# Restore backup
psql -U postgres -h localhost eorbitor_pulse < backup.sql

# Drop database (be careful!)
dropdb -U postgres -h localhost eorbitor_pulse
```

---

## Summary: Your PostgreSQL Setup

| Setting | Value |
|---------|-------|
| **Username** | postgres |
| **Password** | PostgreSQL@2026 (or your choice) |
| **Host** | localhost |
| **Port** | 5432 |
| **Database** | eorbitor_pulse |
| **Connection String** | postgresql://postgres:PostgreSQL@2026@localhost:5432/eorbitor_pulse |

---

## Next Steps

Once PostgreSQL is configured:

1. Update `.env.local` with correct DATABASE_URL
2. Run: `npm run db:push`
3. Run: `npm run db:seed`
4. Run: `npm run dev`
5. Open: http://localhost:3000
6. Login with: `admin@company.local` / `password`

**Done! Your eOrbitor Pulse CRM is ready to use! 🚀**
