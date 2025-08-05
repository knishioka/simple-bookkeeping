#!/bin/bash

# Setup script for local development environment
# This script sets up a complete local development environment for Simple Bookkeeping

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Header
echo "=========================================="
echo "🚀 Simple Bookkeeping Local Setup"
echo "=========================================="
echo ""

# Check prerequisites
print_info "Checking prerequisites..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install pnpm first:"
    echo "npm install -g pnpm"
    exit 1
fi

# Check for Docker (optional)
USE_DOCKER=false
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    read -p "Docker is available. Do you want to use Docker for PostgreSQL? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        USE_DOCKER=true
    fi
else
    print_warning "Docker is not installed. You'll need to set up PostgreSQL manually."
fi

print_success "Prerequisites check completed"
echo ""

# Setup environment files
print_info "Setting up environment files..."

# Copy .env.example to .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    print_success "Created .env from .env.example"
else
    print_warning ".env already exists, skipping..."
fi

# Copy .env.local.example to .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    if [ -f .env.local.example ]; then
        cp .env.local.example .env.local
        print_success "Created .env.local from .env.local.example"
    fi
else
    print_warning ".env.local already exists, skipping..."
fi

echo ""

# Install dependencies
print_info "Installing dependencies..."
pnpm install
print_success "Dependencies installed"
echo ""

# Database setup
if [ "$USE_DOCKER" = true ]; then
    print_info "Starting PostgreSQL with Docker..."
    
    # Use the local Docker Compose configuration
    docker compose -f docker compose.local.yml up -d postgres
    
    # Wait for PostgreSQL to be ready
    print_info "Waiting for PostgreSQL to be ready..."
    sleep 5
    
    # Check if PostgreSQL is ready
    max_attempts=30
    attempt=0
    while ! docker compose -f docker compose.local.yml exec -T postgres pg_isready -U bookkeeping > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -eq $max_attempts ]; then
            print_error "PostgreSQL failed to start after $max_attempts attempts"
            exit 1
        fi
        echo -n "."
        sleep 1
    done
    echo ""
    print_success "PostgreSQL is ready"
else
    print_warning "Please ensure PostgreSQL is running and accessible at:"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: simple_bookkeeping"
    echo "  User: Update DATABASE_URL in .env"
    echo ""
    read -p "Press Enter when PostgreSQL is ready..." -n 1 -r
    echo ""
fi

# Generate Prisma client
print_info "Generating Prisma client..."
pnpm --filter @simple-bookkeeping/database prisma:generate
print_success "Prisma client generated"
echo ""

# Run database migrations
print_info "Running database migrations..."
pnpm db:migrate
print_success "Database migrations completed"
echo ""

# Seed database
print_info "Seeding database with initial data..."
pnpm db:seed
print_success "Database seeded"
echo ""

# Build packages
print_info "Building shared packages..."
pnpm build:packages
print_success "Packages built"
echo ""

# Final instructions
echo "=========================================="
echo "✅ Local environment setup completed!"
echo "=========================================="
echo ""
echo "To start the development servers:"
echo ""

if [ "$USE_DOCKER" = true ]; then
    echo "  With Docker (recommended):"
    echo "  $ docker compose -f docker compose.local.yml up"
    echo ""
    echo "  Or start services individually:"
    echo "  $ docker compose -f docker compose.local.yml up postgres  # Database only"
    echo "  $ pnpm dev                                                # Start app servers"
else
    echo "  $ pnpm dev                    # Start both API and Web servers"
    echo "  $ pnpm --filter web dev       # Start Web server only"
    echo "  $ pnpm --filter api dev       # Start API server only"
fi

echo ""
echo "Default URLs:"
echo "  Web app: http://localhost:3000"
echo "  API: http://localhost:3001"
echo "  API docs: http://localhost:3001/api-docs"
echo ""
echo "Default login credentials:"
echo "  Email: admin@example.com"
echo "  Password: password123"
echo ""
echo "For more information, see DEVELOPMENT.md"
echo ""
