#!/bin/bash
# Napoleon Game - Docker Development Helper Script
#
# Docker Compose はインフラ（Supabase DB等）のみを管理
# Next.js アプリは vercel dev でホスト上で実行
#
# Usage:
#   ./docker-dev.sh up      - Start infrastructure services
#   ./docker-dev.sh down    - Stop infrastructure services
#   ./docker-dev.sh status  - Show service status
#   ./docker-dev.sh logs    - Show service logs
#   ./docker-dev.sh reset   - Reset database (delete volumes)
#   ./docker-dev.sh dev     - Start infra + vercel dev

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# Start infrastructure services
start_infra() {
    print_info "Starting infrastructure services (Supabase DB, Auth, REST, Studio)..."
    docker-compose up -d
    print_success "Infrastructure services started!"
    echo ""
    print_info "Services:"
    echo "  - PostgreSQL:     localhost:54322"
    echo "  - Supabase Auth:  localhost:54324"
    echo "  - Supabase REST:  localhost:54323"
    echo "  - Supabase Studio: localhost:54325"
    echo ""
    print_info "Next.js app: run 'vercel dev' separately"
}

# Stop infrastructure services
stop_infra() {
    print_info "Stopping infrastructure services..."
    docker-compose down
    print_success "Infrastructure services stopped!"
}

# Show service status
show_status() {
    print_info "Service status:"
    docker-compose ps
}

# Show service logs
show_logs() {
    docker-compose logs -f "${2:-}"
}

# Reset database
reset_db() {
    print_warning "This will delete all local database data!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        print_success "Database reset complete!"
    else
        print_info "Cancelled."
    fi
}

# Start infra + vercel dev
start_dev() {
    start_infra
    echo ""
    print_info "Starting Next.js via vercel dev..."
    vercel dev
}

# Show usage
show_usage() {
    cat << EOF
Napoleon Game - Docker Development Helper

Usage:
  ./docker-dev.sh [command]

Commands:
  up      Start infrastructure services (Supabase DB, Auth, REST, Studio)
  down    Stop infrastructure services
  status  Show service status
  logs    Show service logs (optionally specify service name)
  reset   Reset database (delete volumes)
  dev     Start infra + vercel dev (all-in-one)

Examples:
  ./docker-dev.sh up              # Start Supabase infra
  ./docker-dev.sh dev             # Start infra + Next.js
  ./docker-dev.sh logs supabase-db  # Show DB logs
  ./docker-dev.sh reset           # Reset database

Architecture:
  Docker Compose → Supabase infrastructure only
  vercel dev     → Next.js app (reads keys from Vercel)

Options:
  -h, --help    Show this help message
EOF
}

# Main script logic
case "${1:-}" in
    up)
        start_infra
        ;;
    down)
        stop_infra
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$@"
        ;;
    reset)
        reset_db
        ;;
    dev)
        start_dev
        ;;
    -h|--help|"")
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
