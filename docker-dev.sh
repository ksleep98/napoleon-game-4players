#!/bin/bash
# Napoleon Game - Docker Development Helper Script
# Usage:
#   ./docker-dev.sh build  - Build the Docker image
#   ./docker-dev.sh run    - Run container and start pnpm dev
#   ./docker-dev.sh shell  - Enter container shell (bash)
#   ./docker-dev.sh exec   - Execute custom command in container

set -e

IMAGE_NAME="napoleon-game-dev"
CONTAINER_NAME="napoleon-game-container"

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

# Function to build Docker image
build_image() {
    print_info "Building Docker image: ${IMAGE_NAME}..."
    docker build -t "${IMAGE_NAME}" .
    print_success "Docker image built successfully!"
}

# Function to stop and remove existing container
cleanup_container() {
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_warning "Stopping and removing existing container..."
        docker stop "${CONTAINER_NAME}" 2>/dev/null || true
        docker rm "${CONTAINER_NAME}" 2>/dev/null || true
    fi
}

# Function to run container with pnpm dev
run_dev() {
    cleanup_container

    print_info "Starting container with pnpm dev..."
    print_info "Access the application at: http://localhost:3000"
    print_info "Press Ctrl+C to stop the server"

    # Check if .env.local exists
    if [ -f .env.local ]; then
        print_success "Found .env.local, loading environment variables..."
        docker run -it --rm \
            --name "${CONTAINER_NAME}" \
            -p 3000:3000 \
            -v "$(pwd)/src:/app/src" \
            -v "$(pwd)/public:/app/public" \
            -v "$(pwd)/.env.local:/app/.env.local:ro" \
            -e NODE_ENV=development \
            "${IMAGE_NAME}" \
            pnpm dev
    else
        print_warning ".env.local not found, running without environment variables..."
        docker run -it --rm \
            --name "${CONTAINER_NAME}" \
            -p 3000:3000 \
            -v "$(pwd)/src:/app/src" \
            -v "$(pwd)/public:/app/public" \
            -e NODE_ENV=development \
            "${IMAGE_NAME}" \
            pnpm dev
    fi
}

# Function to enter container shell
run_shell() {
    cleanup_container

    print_info "Starting container with bash shell..."
    print_info "Type 'pnpm dev' to start the development server"
    print_info "Type 'exit' to leave the container"

    # Check if .env.local exists
    if [ -f .env.local ]; then
        print_success "Found .env.local, loading environment variables..."
        docker run -it --rm \
            --name "${CONTAINER_NAME}" \
            -p 3000:3000 \
            -v "$(pwd)/src:/app/src" \
            -v "$(pwd)/public:/app/public" \
            -v "$(pwd)/.env.local:/app/.env.local:ro" \
            -e NODE_ENV=development \
            "${IMAGE_NAME}" \
            bash
    else
        print_warning ".env.local not found, running without environment variables..."
        docker run -it --rm \
            --name "${CONTAINER_NAME}" \
            -p 3000:3000 \
            -v "$(pwd)/src:/app/src" \
            -v "$(pwd)/public:/app/public" \
            -e NODE_ENV=development \
            "${IMAGE_NAME}" \
            bash
    fi
}

# Function to execute custom command
run_exec() {
    if [ -z "$2" ]; then
        print_error "Please provide a command to execute"
        print_info "Example: ./docker-dev.sh exec 'pnpm test'"
        exit 1
    fi

    cleanup_container

    print_info "Executing command: $2"

    # Check if .env.local exists
    if [ -f .env.local ]; then
        print_success "Found .env.local, loading environment variables..."
        docker run -it --rm \
            --name "${CONTAINER_NAME}" \
            -p 3000:3000 \
            -v "$(pwd)/src:/app/src" \
            -v "$(pwd)/public:/app/public" \
            -v "$(pwd)/.env.local:/app/.env.local:ro" \
            -e NODE_ENV=development \
            "${IMAGE_NAME}" \
            bash -c "$2"
    else
        print_warning ".env.local not found, running without environment variables..."
        docker run -it --rm \
            --name "${CONTAINER_NAME}" \
            -p 3000:3000 \
            -v "$(pwd)/src:/app/src" \
            -v "$(pwd)/public:/app/public" \
            -e NODE_ENV=development \
            "${IMAGE_NAME}" \
            bash -c "$2"
    fi
}

# Function to show usage
show_usage() {
    cat << EOF
Napoleon Game - Docker Development Helper

Usage:
  ./docker-dev.sh [command]

Commands:
  build   Build the Docker image
  run     Run container and start pnpm dev (default)
  shell   Enter container shell (bash)
  exec    Execute custom command in container

Examples:
  ./docker-dev.sh build
  ./docker-dev.sh run
  ./docker-dev.sh shell
  ./docker-dev.sh exec 'pnpm test'
  ./docker-dev.sh exec 'pnpm lint'

Options:
  -h, --help    Show this help message

Note: The 'src' and 'public' directories are mounted as volumes for hot-reload.
EOF
}

# Main script logic
case "${1:-run}" in
    build)
        build_image
        ;;
    run)
        if ! docker images | grep -q "${IMAGE_NAME}"; then
            print_warning "Image not found. Building first..."
            build_image
        fi
        run_dev
        ;;
    shell)
        if ! docker images | grep -q "${IMAGE_NAME}"; then
            print_warning "Image not found. Building first..."
            build_image
        fi
        run_shell
        ;;
    exec)
        if ! docker images | grep -q "${IMAGE_NAME}"; then
            print_warning "Image not found. Building first..."
            build_image
        fi
        run_exec "$@"
        ;;
    -h|--help)
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
