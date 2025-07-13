#!/bin/bash

# Full VAuto Testing Script
# This script runs VAuto automation with full integration for testing

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
export TEST_MODE=false
export HEADLESS=false
export SLOW_MO=1000
export SCREENSHOT_ON_FAILURE=true
export LOG_LEVEL=debug
export DRY_RUN=false
export READ_ONLY_MODE=false
export MAX_VEHICLES_TO_PROCESS=1
export STOP_ON_FIRST_ERROR=true
export BROWSER_TIMEOUT=30000
export DEFAULT_RETRIES=1
export DASHBOARD_INTEGRATION=true
export ENABLE_2FA=true
export TWO_FACTOR_METHOD=sms

# Additional safety settings
# Clear any existing report emails to prevent accidental sending during testing
unset REPORT_EMAILS

echo "🚀 Starting VAuto full test run..."
echo "   Browser will be visible for monitoring"
echo "   Press Ctrl+C to stop at any time"
echo ""

# Run the test
npm run vauto:once

echo ""
echo "✅ Test completed!"
echo "📸 Check screenshots/ directory for any error screenshots"
echo "📋 Check logs for detailed execution information"
echo "🔍 Verify changes in VAuto (limited to 1 vehicle)" 