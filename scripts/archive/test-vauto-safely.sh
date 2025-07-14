#!/bin/bash

# Safe VAuto Testing Script
# This script runs VAuto automation in a safe, read-only mode for testing

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

# Set test environment variables
export TEST_MODE=true
export HEADLESS=false
export SLOW_MO=1000
export SCREENSHOT_ON_FAILURE=true
export LOG_LEVEL=debug
export DRY_RUN=true
export READ_ONLY_MODE=true
export MAX_VEHICLES_TO_PROCESS=1
export STOP_ON_FIRST_ERROR=true
export BROWSER_TIMEOUT=30000
export DEFAULT_RETRIES=1
export DASHBOARD_INTEGRATION=false

# Additional safety settings
export ENABLE_2FA=true
export TWO_FACTOR_METHOD=sms

# Clear any existing report emails to prevent accidental sending
unset REPORT_EMAILS

echo "🚀 Starting VAuto test run..."
echo "   Browser will be visible for monitoring"
echo "   Press Ctrl+C to stop at any time"
echo ""

# Run the test
npm run vauto:once

echo ""
echo "✅ Test completed!"
echo "📸 Check screenshots/ directory for any error screenshots"
echo "📋 Check logs for detailed execution information" 