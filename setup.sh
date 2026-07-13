#!/usr/bin/env bash
# setup.sh — Bootstrap local dev environment from scratch
# Run once after cloning: ./setup.sh

set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     FSTail Platform — Local Dev Setup        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Prerequisites check ──────────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "❌ Node.js >=20 required. Install from nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1  || { echo "❌ npm required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required. Install from docker.com"; exit 1; }

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 20 ]; then
  echo "❌ Node.js >=20 required. Found: $(node -v)"
  exit 1
fi

echo "✓ Node.js $(node -v)"
echo "✓ npm $(npm -v)"
echo "✓ Docker $(docker -v | cut -d' ' -f3 | tr -d ',')"
echo ""

# ── Environment file ─────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
  echo ""
  echo "⚠️  Review .env and set your JWT secrets before running the app:"
  echo "   JWT_ACCESS_SECRET  — run: openssl rand -base64 64"
  echo "   JWT_REFRESH_SECRET — run: openssl rand -base64 64"
  echo ""
else
  echo "✓ .env already exists"
fi

# ── Install dependencies ─────────────────────────────────────────────
echo "Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# ── Start Docker services ────────────────────────────────────────────
echo "Starting PostgreSQL and Redis..."
docker compose up -d
echo "Waiting for PostgreSQL to be ready..."

# Wait for postgres healthcheck
RETRIES=15
until docker compose exec -T postgres pg_isready -U fstail -d fstail_platform > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "  PostgreSQL not ready yet... ($RETRIES retries left)"
  sleep 2
  RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
  echo "❌ PostgreSQL failed to start. Check: docker compose logs postgres"
  exit 1
fi

echo "✓ PostgreSQL ready"
echo "✓ Redis ready"
echo ""

# ── Prisma ───────────────────────────────────────────────────────────
echo "Running database migrations..."
cd apps/api
npm run db:generate
npm run db:migrate
echo "✓ Migrations applied"

echo ""
echo "Seeding database..."
npm run db:seed
echo "✓ Database seeded"
cd ../..

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║             Setup Complete ✅                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Start the development server:"
echo "  npm run dev"
echo ""
echo "Services:"
echo "  Web app:      http://localhost:3000"
echo "  API:          http://localhost:3001/api"
echo "  Swagger docs: http://localhost:3001/api/docs"
echo "  DB Studio:    npm run db:studio (from apps/api)"
echo ""
echo "Default login:"
echo "  Email:    admin@fstailsolutions.com.ar"
echo "  Password: ChangeMe123!"
echo ""
echo "⚠️  Change the admin password and JWT secrets before using in production."
echo ""
