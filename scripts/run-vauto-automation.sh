#!/bin/bash

# VAuto Complete Automation Runner
# This script handles the entire automation flow without manual intervention

set -e  # Exit on any error

MODE=${1:-safe}  # Default to safe mode
CLEANUP_ON_EXIT=true

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🔷 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to cleanup background processes
cleanup() {
    print_status "Cleaning up background processes..."
    
    if [ ! -z "$SERVER_PID" ] && kill -0 $SERVER_PID 2>/dev/null; then
        print_status "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$AUTO_INJECT_PID" ] && kill -0 $AUTO_INJECT_PID 2>/dev/null; then
        print_status "Stopping auto-inject monitor (PID: $AUTO_INJECT_PID)..."
        kill $AUTO_INJECT_PID 2>/dev/null || true
        wait $AUTO_INJECT_PID 2>/dev/null || true
    fi
    
    # Kill any remaining background jobs
    jobs -p | xargs -r kill 2>/dev/null || true
    
    print_success "Cleanup complete"
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Handle interrupt signal
trap 'print_warning "Interrupted by user"; exit 130' INT

echo "🚀 VAuto Complete Automation Runner"
echo "=================================="
echo ""

# Load environment variables from .env file
if [ -f ".env" ]; then
    print_status "Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
    print_success "Environment variables loaded"
else
    print_warning "No .env file found, using system environment variables"
fi

if [ "$MODE" = "full" ]; then
    print_warning "FULL MODE: Real changes will be made to VAuto!"
    export TEST_MODE=false
    export DRY_RUN=false
    export READ_ONLY_MODE=false
else
    print_status "SAFE MODE: Read-only operations only"
    export TEST_MODE=true
    export DRY_RUN=true
    export READ_ONLY_MODE=true
fi

# Check required environment variables
print_status "Checking environment variables..."

required_vars=("VAUTO_USERNAME" "VAUTO_PASSWORD" "TWILIO_ACCOUNT_SID" "TWILIO_AUTH_TOKEN" "TWILIO_PHONE_NUMBER")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    printf '   %s\n' "${missing_vars[@]}"
    echo ""
    echo "Please set these variables in your .env file or environment"
    exit 1
fi

print_success "All required environment variables found"

# Set automation configuration
export HEADLESS=false
export SLOW_MO=1000
export SCREENSHOT_ON_FAILURE=true
export LOG_LEVEL=info
export MAX_VEHICLES_TO_PROCESS=1
export ENABLE_2FA=true
export TWO_FACTOR_METHOD=sms
export PUBLIC_URL=http://localhost:3000
export PORT=3000

# CRITICAL: Disable dashboard integration to prevent port conflict
export DASHBOARD_INTEGRATION=false

# Clear report emails to prevent accidental sending during testing
unset REPORT_EMAILS

echo ""
print_status "Step 1: Starting local server..."

# Start the server in background
npm run server:dev &
SERVER_PID=$!

print_status "Server starting (PID: $SERVER_PID)..."

# Wait for server to be ready
print_status "Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        print_success "Server is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Server failed to start within 30 seconds"
        exit 1
    fi
    sleep 1
done

# Start ngrok if not running
if ! pgrep -f 'ngrok http 3000' > /dev/null; then
    ngrok http 3000 &> ngrok.log &
    NGROK_PID=$!
    sleep 2
fi

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*.ngrok-free.app')
export PUBLIC_URL=$NGROK_URL

echo ""
print_status "Step 2: Configuring Twilio webhook for local testing..."

# Update Twilio webhook to point to local server
node update-twilio-webhook-local.js || {
    print_warning "Could not update Twilio webhook automatically"
    print_status "You may need to manually set your Twilio webhook to:"
    print_status "$PUBLIC_URL/webhooks/twilio/sms"
}

echo ""
print_status "Step 3: Starting auto-injection monitor..."

# Start the auto-injection monitor in background
node auto-inject-2fa.js &
AUTO_INJECT_PID=$!

print_status "Auto-injection monitor starting (PID: $AUTO_INJECT_PID)..."

# Give it a moment to initialize
sleep 2

# Check if auto-inject process is still running
if ! kill -0 $AUTO_INJECT_PID 2>/dev/null; then
    print_error "Auto-injection monitor failed to start"
    exit 1
fi

print_success "Auto-injection monitor is running"

echo ""
print_status "Step 4: Testing 2FA infrastructure..."

# Test the 2FA endpoint
if curl -s http://localhost:3000/api/2fa/latest > /dev/null; then
    print_success "2FA webhook endpoint is accessible"
else
    print_error "2FA webhook endpoint is not accessible"
    exit 1
fi

echo ""
print_status "Step 5: Starting VAuto automation..."
print_status "Browser will be visible for monitoring"
print_status "The automation will automatically handle 2FA when needed"
echo ""

print_warning "IMPORTANT: When VAuto prompts for 2FA:"
print_warning "1. The automation will automatically poll for SMS codes"
print_warning "2. SMS codes will be automatically injected"
print_warning "3. The automation will click Verify automatically"
print_warning "4. No manual intervention should be needed"

echo ""
print_status "Starting automation in 3 seconds..."
sleep 3

# Run the automation
npm run vauto:once

# Check the exit code
if [ $? -eq 0 ]; then
    print_success "VAuto automation completed successfully!"
else
    print_error "VAuto automation failed"
    exit 1
fi

echo ""
print_success "Automation completed!"
print_status "Check screenshots/ directory for any screenshots taken during execution"
print_status "Check server logs for detailed execution information"

# Note about webhook restoration
echo ""
print_warning "NOTE: Your Twilio webhook was temporarily pointed to localhost for this test"
print_warning "To restore production webhook, run: node update-twilio-webhook.js"