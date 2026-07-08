#!/bin/bash

# eOrbitor Pulse - One-Click Project Runner for macOS

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DB_URL='postgresql://eorbitor:YourStrongDatabasePassword123!@localhost:5432/eorbitor_pulse'
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
step() { echo -e "${BLUE}[..] $1${NC}"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
fail() { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

echo -e "${CYAN}"
echo "  eOrbitor Pulse CRM - macOS Startup"
echo "======================================"
echo -e "${NC}"

cd "$PROJECT_DIR"

# Prerequisites
step "Checking Node.js..."
command -v node &>/dev/null || fail "Node.js not installed. Please install it: brew install node"
ok "Node.js $(node -v)"

step "Checking PostgreSQL..."
command -v psql &>/dev/null || fail "PostgreSQL not installed. Please install it: brew install postgresql@14"
ok "PostgreSQL installed"

# Start PostgreSQL service via Homebrew
step "Starting PostgreSQL service via Homebrew..."
if command -v brew &>/dev/null; then
    if ! brew services list | grep -qE "postgresql(@[0-9]+)?\s+started"; then
        step "Starting PostgreSQL via Homebrew..."
        brew services start postgresql@14 || brew services start postgresql || true
    fi
else
    warn "Homebrew not found. Please ensure PostgreSQL is running."
fi
ok "PostgreSQL running"

# Database setup
step "Checking database connection..."
if ! PGPASSWORD='YourStrongDatabasePassword123!' psql -U eorbitor -h localhost -d eorbitor_pulse -c "SELECT 1;" &>/dev/null; then
    warn "Database or user not found. Setting up database..."
    if psql postgres -c "SELECT 1;" &>/dev/null; then
        psql postgres -c "CREATE USER eorbitor WITH PASSWORD 'YourStrongDatabasePassword123!';" 2>/dev/null || true
        psql postgres -c "CREATE DATABASE eorbitor_pulse OWNER eorbitor;" 2>/dev/null || true
        psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE eorbitor_pulse TO eorbitor;" 2>/dev/null || true
    else
        fail "Could not connect to PostgreSQL superuser to set up the DB. Please check connection manually."
    fi
    PGPASSWORD='YourStrongDatabasePassword123!' psql -U eorbitor -h localhost -d eorbitor_pulse -c "SELECT 1;" &>/dev/null || fail "Database setup failed"
fi
ok "Database connection OK"

# .env.local
step "Checking environment config..."
[ -f ".env.local" ] || cp .env.local.example .env.local
[ -f ".env" ] || cp .env.local.example .env
ok "Environment config ready"

# Dependencies
step "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    step "Installing npm packages..."
    npm install
fi
ok "Dependencies ready"

# Prisma
step "Generating Prisma client..."
DATABASE_URL="$DB_URL" npm run prisma:generate --silent
ok "Prisma client generated"

step "Syncing database schema..."
DATABASE_URL="$DB_URL" npm run db:push --silent
ok "Schema synced"

# Seed if empty
USER_COUNT=$(PGPASSWORD='YourStrongDatabasePassword123!' psql -U eorbitor -h localhost -d eorbitor_pulse -tAc 'SELECT COUNT(*) FROM "User";' 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ]; then
    step "Seeding database..."
    DATABASE_URL="$DB_URL" npm run db:seed
    DATABASE_URL="$DB_URL" node prisma/seed-users.js
    ok "Database seeded"
else
    ok "Database has data ($USER_COUNT users)"
fi

# Free port 3000
if lsof -ti:3000 &>/dev/null; then
    warn "Port 3000 in use, freeing it..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo ""
echo -e "${GREEN}======================================"
echo "  Ready! Starting eOrbitor Pulse..."
echo "======================================"
echo -e "${NC}"
echo -e "  URL:      ${CYAN}http://localhost:3000${NC}"
echo -e "  Login:    admin@eorbitor.com"
echo -e "  Password: admin123"
echo ""
echo -e "${YELLOW}  Press Ctrl+C to stop${NC}"
echo ""

DATABASE_URL="$DB_URL" npm run dev
