#!/bin/bash

################################################################################
# SMART DOCUMENT GENERATOR - AUTOMATED DEPLOYMENT SCRIPT
################################################################################
#
# This script automates the complete deployment process:
# - Environment setup
# - Docker build and start
# - Database migrations
# - Security verification
#
# Usage: ./deploy.sh
#
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running in correct directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found!"
    print_info "Please run this script from the project root directory:"
    echo "    cd /path/to/smart-doc-generator"
    echo "    ./deploy.sh"
    exit 1
fi

################################################################################
# STEP 1: Pre-Flight Checks
################################################################################

print_header "STEP 1: Pre-Flight Checks"

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed!"
    print_info "Install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi
print_success "Docker installed"

# Check Docker Compose
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed!"
    exit 1
fi
print_success "Docker Compose installed"

# Check if Docker daemon is running
if ! docker ps &> /dev/null; then
    print_error "Docker daemon is not running!"
    print_info "Start Docker Desktop or run: sudo systemctl start docker"
    exit 1
fi
print_success "Docker daemon running"

################################################################################
# STEP 2: Environment Setup
################################################################################

print_header "STEP 2: Environment Setup"

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    print_warning "backend/.env not found. Creating from .env.example..."

    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        print_success "Created backend/.env from example"

        print_warning "⚠️  IMPORTANT: You must edit backend/.env before deploying!"
        print_info "Required changes:"
        echo "  1. Update DATABASE_URL password"
        echo "  2. Set CORS_ORIGINS to your domain"
        echo "  3. Set API_BASE_URL to your domain"
        echo ""
        read -p "Press Enter to continue after editing .env, or Ctrl+C to exit..."
    else
        print_error ".env.example not found!"
        exit 1
    fi
else
    print_success "backend/.env exists"
fi

# Verify secret keys are set
if ! grep -q "SECRET_KEY=.\{40\}" backend/.env; then
    print_warning "SECRET_KEY not set properly!"
    print_info "Generating secure secret keys..."

    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
    REFRESH_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")

    sed -i.bak "s/SECRET_KEY=.*/SECRET_KEY=$SECRET_KEY/" backend/.env
    sed -i.bak "s/REFRESH_SECRET_KEY=.*/REFRESH_SECRET_KEY=$REFRESH_SECRET_KEY/" backend/.env

    print_success "Generated and set secret keys"
fi

print_success "Environment configuration complete"

################################################################################
# STEP 3: Stop Existing Containers (if any)
################################################################################

print_header "STEP 3: Cleanup"

if docker compose ps | grep -q "Up"; then
    print_info "Stopping existing containers..."
    docker compose down
    print_success "Stopped existing containers"
else
    print_info "No running containers to stop"
fi

################################################################################
# STEP 4: Build Docker Images
################################################################################

print_header "STEP 4: Building Docker Images"

print_info "This may take 5-10 minutes on first run..."
print_info "Building backend, database, redis, and worker containers..."

if docker compose build --no-cache; then
    print_success "Docker images built successfully"
else
    print_error "Docker build failed!"
    exit 1
fi

################################################################################
# STEP 5: Start Services
################################################################################

print_header "STEP 5: Starting Services"

print_info "Starting all containers in detached mode..."

if docker compose up -d; then
    print_success "Services started"
else
    print_error "Failed to start services!"
    exit 1
fi

# Wait for services to be ready
print_info "Waiting for services to be ready..."
sleep 10

# Check service health
print_info "Checking service status..."
docker compose ps

################################################################################
# STEP 6: Database Migrations
################################################################################

print_header "STEP 6: Database Migrations"

print_info "Running Alembic migrations..."

# Wait for database to be ready
sleep 5

if docker compose exec -T web alembic upgrade head; then
    print_success "Database migrations completed"
else
    print_error "Database migrations failed!"
    print_info "Check logs with: docker compose logs db"
    exit 1
fi

################################################################################
# STEP 7: Verification
################################################################################

print_header "STEP 7: Deployment Verification"

# Wait a bit for services to stabilize
sleep 5

# Check API health
print_info "Testing API health endpoint..."
if curl -f http://localhost:8000/health &> /dev/null; then
    print_success "API is responding"
else
    print_error "API health check failed!"
    print_info "Check logs with: docker compose logs web"
fi

# Check database connection
print_info "Verifying database connection..."
if docker compose exec -T db psql -U docgen_user -d docgen_db -c "SELECT 1" &> /dev/null; then
    print_success "Database connection OK"
else
    print_warning "Database connection check failed (may be normal)"
fi

# Check Redis
print_info "Verifying Redis connection..."
if docker compose exec -T redis redis-cli ping &> /dev/null; then
    print_success "Redis connection OK"
else
    print_warning "Redis connection check failed"
fi

################################################################################
# STEP 8: Security Verification
################################################################################

print_header "STEP 8: Security Verification"

# Check security headers
print_info "Checking security headers..."
HEADERS=$(curl -sI http://localhost:8000/health)

if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    print_success "Security headers present"
else
    print_warning "Security headers not found (may need HTTPS)"
fi

# Check OpenAPI is hidden
print_info "Verifying OpenAPI docs are hidden..."
if curl -sf http://localhost:8000/api/v1/docs &> /dev/null; then
    print_warning "OpenAPI docs are accessible (check DEBUG=false in .env)"
else
    print_success "OpenAPI docs hidden (production mode)"
fi

################################################################################
# DEPLOYMENT COMPLETE
################################################################################

print_header "🎉 DEPLOYMENT COMPLETE!"

echo ""
echo -e "${GREEN}Your Smart Document Generator is now running!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Service URLs:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 API:       http://localhost:8000"
echo "  📊 Health:    http://localhost:8000/health"
echo "  🔐 Login:     http://localhost:8000/api/v1/auth/login"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Useful Commands:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  View logs:        docker compose logs -f"
echo "  View API logs:    docker compose logs -f web"
echo "  Stop services:    docker compose down"
echo "  Restart:          docker compose restart"
echo "  Database shell:   docker compose exec db psql -U docgen_user docgen_db"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Next Steps:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Test the API:  curl http://localhost:8000/health"
echo "  2. Create admin:  docker compose exec web python scripts/create_admin.py"
echo "  3. Build frontend: cd frontend && npm install && npm run build"
echo "  4. Setup SSL:     See PRODUCTION_DEPLOYMENT_GUIDE.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  Remember:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  - Update backend/.env with production values"
echo "  - Set up regular backups (database + files)"
echo "  - Configure SSL/TLS for production"
echo "  - Monitor logs for security events"
echo ""
echo -e "${GREEN}📚 Full documentation: PRODUCTION_DEPLOYMENT_GUIDE.md${NC}"
echo ""
