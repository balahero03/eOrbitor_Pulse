#!/bin/bash

# eOrbitor Pulse - Ubuntu/Linux Start Script
# Run with: bash start.sh

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║          eOrbitor Pulse CRM - Linux Startup Script            ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check for prerequisites
echo "🔍 Checking Prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js found: $NODE_VERSION"
else
    echo "❌ Node.js NOT found!"
    echo "   Install from: https://nodejs.org/"
    echo "   Or use: sudo apt-get install nodejs npm"
    read -p "Press Enter to exit"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm found: v$NPM_VERSION"
else
    echo "❌ npm NOT found!"
    read -p "Press Enter to exit"
    exit 1
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version)
    echo "✅ PostgreSQL found: $PSQL_VERSION"
else
    echo "⚠️  PostgreSQL NOT found or not in PATH"
    echo "   Install from: https://www.postgresql.org/"
    echo "   On Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    echo "   Make sure PostgreSQL is running: sudo systemctl status postgresql"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Check if .env.local exists
echo ""
echo "📋 Step 1: Checking environment configuration..."

if [ -f ".env.local" ]; then
    echo "✅ .env.local already exists"
    CONFIG_EXISTS=true
else
    echo "⚠️  .env.local not found"

    if [ -f ".env.local.example" ]; then
        echo "📋 Copying .env.local.example to .env.local..."
        cp .env.local.example .env.local
        echo "✅ .env.local created"
        CONFIG_EXISTS=false
    else
        echo "❌ .env.local.example not found!"
        read -p "Press Enter to exit"
        exit 1
    fi
fi

# Step 2: Check/Update database configuration
echo ""
echo "📋 Step 2: Database Configuration"

if grep -q 'postgresql://.*@localhost:5432' .env.local; then
    echo "✅ Database URL configured"

    # Extract current database URL
    DB_URL=$(grep 'DATABASE_URL=' .env.local | cut -d'"' -f2)
    echo "   Current: $DB_URL"
else
    echo "⚠️  Database URL not properly configured"
fi

# Offer to update database configuration
echo ""
echo "Database Configuration Help:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ℹ️  To find your PostgreSQL password:"
echo ""
echo "   Option 1: Check PostgreSQL Default Credentials"
echo "     - Default user: postgres"
echo "     - Default password: (set during installation or empty)"
echo "     - Test connection: psql -U postgres -h localhost"
echo ""
echo "   Option 2: Reset PostgreSQL Password (Linux)"
echo "     1. Open terminal as root or use sudo"
echo "     2. Switch to postgres user: sudo su - postgres"
echo "     3. Connect to database: psql"
echo "     4. Run: ALTER USER postgres WITH PASSWORD 'newpassword';"
echo "     5. Type: \\q to exit"
echo ""
echo "   Option 3: Check PostgreSQL Config File"
echo "     - On Ubuntu: ~/.pgpass or /etc/postgresql/*/main/postgresql.conf"
echo "     - Or check your installation notes"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Do you need to update .env.local with database password? (y/n): " UPDATE_CONFIG

if [[ "$UPDATE_CONFIG" == "y" || "$UPDATE_CONFIG" == "Y" ]]; then
    echo ""
    echo "Opening .env.local for editing..."
    echo "Find the line: DATABASE_URL="
    echo "Update it with your PostgreSQL password"
    echo ""

    # Try common editors
    if command -v nano &> /dev/null; then
        nano .env.local
    elif command -v vi &> /dev/null; then
        vi .env.local
    else
        echo "❌ No text editor found. Please edit .env.local manually."
    fi

    echo "✅ File saved"
    DB_CONFIG_UPDATED=true
else
    DB_CONFIG_UPDATED=false
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 3: Install dependencies
echo ""
echo "📋 Step 3: Installing Dependencies..."

if [ -d "node_modules" ]; then
    echo "✅ node_modules already exists"
    read -p "Skip npm install? (y/n): " SKIP_INSTALL
    if [[ "$SKIP_INSTALL" != "y" && "$SKIP_INSTALL" != "Y" ]]; then
        echo "Running: npm install"
        npm install
        if [ $? -ne 0 ]; then
            echo "❌ npm install failed!"
            read -p "Press Enter to exit"
            exit 1
        fi
        echo "✅ Dependencies installed"
    fi
else
    echo "Running: npm install (this may take 2-3 minutes)"
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ npm install failed!"
        read -p "Press Enter to exit"
        exit 1
    fi
    echo "✅ Dependencies installed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 4: Database setup
echo ""
echo "📋 Step 4: Setting up Database..."

read -p "Setup/reset database? (y/n) - Only needed first time or to reset data: " SETUP_DB

if [[ "$SETUP_DB" == "y" || "$SETUP_DB" == "Y" ]]; then
    echo ""
    echo "Step 4a: Generating Prisma Client..."
    npm run prisma:generate
    if [ $? -ne 0 ]; then
        echo "❌ Prisma generate failed!"
        read -p "Press Enter to exit"
        exit 1
    fi
    echo "✅ Prisma Client generated"

    echo ""
    echo "Step 4b: Creating database schema..."
    npm run db:push
    if [ $? -ne 0 ]; then
        echo "❌ Database schema creation failed!"
        echo "⚠️  Check your DATABASE_URL in .env.local"
        echo "⚠️  Make sure PostgreSQL is running: sudo systemctl start postgresql"
        read -p "Press Enter to exit"
        exit 1
    fi
    echo "✅ Database schema created"

    echo ""
    echo "Step 4c: Seeding sample data..."
    npm run db:seed
    if [ $? -ne 0 ]; then
        echo "⚠️  Seed warning (this is usually okay)"
    else
        echo "✅ Sample data created"
    fi
else
    echo "⏭️  Skipping database setup"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 5: Start server
echo ""
echo "🚀 Step 5: Starting Development Server..."
echo ""
echo "Server will start on: http://localhost:3000"
echo "Login with:"
echo "  Email:    admin@company.local"
echo "  Password: password"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the development server
npm run dev

echo ""
echo "Server stopped"
read -p "Press Enter to close this window"
