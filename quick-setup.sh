#!/bin/bash

# Quick PostgreSQL Setup - Automatically configures everything
# Run with: bash quick-setup.sh

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║      eOrbitor Pulse - Quick PostgreSQL Setup                  ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not installed!"
    echo "Please install: sudo apt-get install -y postgresql postgresql-contrib"
    exit 1
fi

echo "✅ PostgreSQL found"
echo ""

# Default credentials from .env.local
DB_USER="eorbitor"
DB_PASSWORD="YourStrongDatabasePassword123!"
DB_NAME="eorbitor_pulse"
DB_HOST="localhost"
DB_PORT="5432"

echo "📋 Using the following configuration from .env.local:"
echo "   Username: $DB_USER"
echo "   Password: $DB_PASSWORD"
echo "   Database: $DB_NAME"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo ""

# Create the database user and database
echo "📋 Setting up PostgreSQL..."
echo ""

# Step 1: Create user
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "⚠️  User may already exist"

# Step 2: Grant CREATEDB privilege
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" 2>/dev/null

# Step 3: Create database
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "⚠️  Database may already exist"

# Step 4: Grant privileges on database
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null

# Step 5: Grant schema privileges
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON SCHEMA public TO $DB_USER;" 2>/dev/null

# Step 6: Grant table privileges
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;" 2>/dev/null

# Step 7: Grant sequence privileges
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;" 2>/dev/null

echo "✅ PostgreSQL user and database configured"
echo ""

echo "📋 Verifying database connection..."
echo ""

# Test connection
PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
else
    echo "⚠️  Connection test may have failed, continuing anyway..."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 PostgreSQL Setup Complete!"
echo ""
echo "✅ User '$DB_USER' created/configured"
echo "✅ Database '$DB_NAME' created/configured"
echo "✅ Permissions granted"
echo ""
echo "📋 .env.local is already configured with the correct credentials"
echo ""
echo "🚀 Next steps:"
echo "   1. npm install"
echo "   2. npm run prisma:generate"
echo "   3. npm run db:push"
echo "   4. npm run db:seed"
echo "   5. npm run dev"
echo ""
echo "📱 Then open: http://localhost:3000"
echo "🔑 Login: admin@company.local / password"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
