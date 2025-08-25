#!/bin/bash

# Start script for production environment with automatic database migration
# This script ensures database is up-to-date before starting the API server

set -e  # Exit on error

echo "🚀 Starting production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL environment variable is not set"
    exit 1
fi

log_info "Database URL detected"

# Navigate to database package directory
cd packages/database

# Run database migrations
log_info "Running database migrations..."
if npx prisma migrate deploy; then
    log_info "Database migrations completed successfully"
else
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        log_info "No pending migrations to apply"
    else
        log_error "Failed to run database migrations (exit code: $EXIT_CODE)"
        
        # Try to get more information about the error
        log_warning "Attempting to check database connection..."
        npx prisma db pull --print 2>&1 | head -20 || true
        
        # Don't exit - let the app start anyway and handle the error
        log_warning "Continuing with application startup despite migration issues..."
    fi
fi

# Generate Prisma client (in case schema changed)
log_info "Generating Prisma client..."
if npx prisma generate; then
    log_info "Prisma client generated successfully"
else
    log_error "Failed to generate Prisma client"
    exit 1
fi

# Navigate back to root
cd ../..

# Start the API server
log_info "Starting API server..."
cd apps/api

# Check if dist directory exists
if [ ! -d "dist" ]; then
    log_error "dist directory not found. Please run the build command first."
    exit 1
fi

# Start the Node.js application
log_info "Launching Node.js application on port ${PORT:-3001}..."
exec node dist/index.js
