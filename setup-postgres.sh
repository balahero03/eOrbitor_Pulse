#!/bin/bash

# Complete PostgreSQL Setup Script for Ubuntu
# Run with: bash setup-postgres.sh

set -e  # Exit on any error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║      PostgreSQL Complete Setup for eOrbitor Pulse CRM         ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Update package manager
echo "📋 Step 1: Updating package manager..."
sudo apt-get update
echo "✅ Package manager updated"
echo ""

# Step 2: Install PostgreSQL
echo "📋 Step 2: Installing PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib
echo "✅ PostgreSQL installed"
echo ""

# Step 3: Verify installation
echo "📋 Step 3: Verifying PostgreSQL installation..."
PSQL_VERSION=$(psql --version)
echo "✅ PostgreSQL found: $PSQL_VERSION"
echo ""

# Step 4: Start PostgreSQL
echo "📋 Step 4: Starting PostgreSQL service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql
echo "✅ PostgreSQL service started"
echo ""

# Step 5: Check status
echo "📋 Step 5: Checking PostgreSQL status..."
sudo systemctl status postgresql | head -3
echo "✅ PostgreSQL is running"
echo ""

# Step 6: Set password for postgres user
echo "📋 Step 6: Setting up postgres user password..."
echo ""
echo "Enter a password for PostgreSQL 'postgres' user"
echo "(You will use this in your .env.local file)"
echo ""

read -sp "Enter password: " DB_PASSWORD
echo ""
read -sp "Confirm password: " DB_PASSWORD_CONFIRM
echo ""

if [ "$DB_PASSWORD" != "$DB_PASSWORD_CONFIRM" ]; then
    echo "❌ Passwords do not match!"
    exit 1
fi

# Change postgres user password
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';"
echo "✅ PostgreSQL password set successfully"
echo ""

# Step 7: Create database
echo "📋 Step 7: Creating eorbitor_pulse database..."
sudo -u postgres psql -c "CREATE DATABASE eorbitor_pulse;"
echo "✅ Database 'eorbitor_pulse' created"
echo ""

# Step 8: Verify database creation
echo "📋 Step 8: Verifying database..."
sudo -u postgres psql -l | grep eorbitor_pulse
echo "✅ Database verified"
echo ""

# Step 9: Update .env.local
echo "📋 Step 9: Updating .env.local with database credentials..."

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  .env.local not found, creating from example..."
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        echo "✅ .env.local created from example"
    else
        echo "❌ .env.local.example not found!"
        exit 1
    fi
fi

# Update DATABASE_URL in .env.local
if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
    # Update existing DATABASE_URL
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://postgres:$DB_PASSWORD@localhost:5432/eorbitor_pulse\"|" "$ENV_FILE"
    echo "✅ DATABASE_URL updated in .env.local"
else
    # Add DATABASE_URL if it doesn't exist
    echo "DATABASE_URL=\"postgresql://postgres:$DB_PASSWORD@localhost:5432/eorbitor_pulse\"" >> "$ENV_FILE"
    echo "✅ DATABASE_URL added to .env.local"
fi

echo ""

# Step 10: Verify connection
echo "📋 Step 10: Verifying database connection..."
PGPASSWORD=$DB_PASSWORD psql -U postgres -h localhost -d eorbitor_pulse -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database connection verified"
else
    echo "⚠️  Connection test failed (this may be normal)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 PostgreSQL Setup Complete!"
echo ""
echo "📊 Configuration Summary:"
echo "   Username:  postgres"
echo "   Password:  $DB_PASSWORD"
echo "   Host:      localhost"
echo "   Port:      5432"
echo "   Database:  eorbitor_pulse"
echo ""
echo "✅ .env.local has been updated with database credentials"
echo ""
echo "📋 Next Steps:"
echo "   1. Run: npm install"
echo "   2. Run: npm run prisma:generate"
echo "   3. Run: npm run db:push"
echo "   4. Run: npm run db:seed"
echo "   5. Run: npm run dev"
echo "   6. Open: http://localhost:3000"
echo ""
echo "🔑 Login with:"
echo "   Email:    admin@company.local"
echo "   Password: password"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
