#!/bin/bash

# Unified VAuto Testing Script
# This script runs VAuto automation in either safe or full mode

MODE=${1:-safe}  # Default to safe mode

if [ "$MODE" = "full" ]; then
    echo "🧪 Starting Full VAuto Test Mode"
    echo "=================================="
    echo ""
    echo "⚠️  FULL MODE ENABLED: Real changes will be made! Limited to 1 vehicle."
    echo "   • DRY_RUN=false (changes will be saved)"
    echo "   • READ_ONLY_MODE=false (write operations enabled)"
    echo "   • MAX_VEHICLES_TO_PROCESS=1 (limit processing)"
    echo "   • HEADLESS=false (visible browser for monitoring)"
    echo "   • SLOW_MO=1000 (slow operations for observation)"
    echo "   • DASHBOARD_INTEGRATION=true (real-time dashboard updates)"
    echo ""
    
    # Set full mode environment variables
    export TEST_MODE=false
    export DRY_RUN=false
    export READ_ONLY_MODE=false
    export DASHBOARD_INTEGRATION=true
else
    echo "🧪 Starting Safe VAuto Test Mode"
    echo "=================================="
    echo ""
    echo "⚠️  SAFETY SETTINGS ENABLED:"
    echo "   • DRY_RUN=true (no changes will be saved)"
    echo "   • READ_ONLY_MODE=true (read-only operations)"
    echo "   • MAX_VEHICLES_TO_PROCESS=1 (limit processing)"
    echo "   • HEADLESS=false (visible browser for monitoring)"
    echo "   • SLOW_MO=1000 (slow operations for observation)"
    echo ""
    
    # Set safe mode environment variables
    export TEST_MODE=true
    export DRY_RUN=true
    export READ_ONLY_MODE=true
    export DASHBOARD_INTEGRATION=false
fi

# Check if credentials are set
if [ -z "$VAUTO_USERNAME" ] || [ -z "$VAUTO_PASSWORD" ]; then
    echo "❌ ERROR: VAuto credentials not found in environment"
    echo "Please set VAUTO_USERNAME and VAUTO_PASSWORD environment variables"
    echo ""
    echo "Example:"
    echo "export VAUTO_USERNAME='your_username'"
    echo "export VAUTO_PASSWORD='your_password'"
    echo "export DEALERSHIP_ID='your_dealership_id'"
    exit 1
fi

echo "✅ Credentials found"
echo ""

# Common environment variables
export HEADLESS=false
export SLOW_MO=1000
export SCREENSHOT_ON_FAILURE=true
export LOG_LEVEL=debug
export MAX_VEHICLES_TO_PROCESS=1
export STOP_ON_FIRST_ERROR=true
export BROWSER_TIMEOUT=30000
export DEFAULT_RETRIES=1
export ENABLE_2FA=true
export TWO_FACTOR_METHOD=sms

# Clear any existing report emails to prevent accidental sending during testing
unset REPORT_EMAILS

echo "🚀 Starting VAuto ${MODE} test run..."
echo "   Browser will be visible for monitoring"
echo "   Press Ctrl+C to stop at any time"
echo ""

# Add diagnostic logging
echo "🔍 DIAGNOSTIC: Checking automation setup..."
echo "   PUBLIC_URL: ${PUBLIC_URL:-NOT SET}"
echo "   TWO_FACTOR_METHOD: ${TWO_FACTOR_METHOD}"
echo "   Server expected at: ${PUBLIC_URL:-http://localhost:3000}"
echo "   Twilio webhook should point to: ${PUBLIC_URL:-http://localhost:3000}/webhooks/twilio/sms"
echo ""

# Check if server is running
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is running on port 3000"
else
    echo "❌ Server is NOT running on port 3000"
    echo "   You may need to start the server first: npm run server:dev"
fi

# Check webhook endpoint
if curl -s http://localhost:3000/api/2fa/latest > /dev/null 2>&1; then
    echo "✅ 2FA webhook endpoint is accessible"
else
    echo "❌ 2FA webhook endpoint is NOT accessible"
fi

echo ""

# Run the test
npm run vauto:once

echo ""
echo "✅ Test completed!"
echo "📸 Check screenshots/ directory for any error screenshots"
echo "📋 Check logs for detailed execution information"

# Usage instructions
if [ "$MODE" = "safe" ]; then
    echo ""
    echo "💡 To run in full mode (with real changes): ./scripts/test-vauto.sh full"
fi 