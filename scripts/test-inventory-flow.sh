#!/bin/bash

# VAuto Inventory Flow Test Script
# Tests the complete flow: login → inventory → vehicle selection → factory equipment → checkbox interactions

echo "🧪 VAuto Inventory Flow Test"
echo "==============================="
echo ""
echo "This test will walk through:"
echo "1. ✅ Login to VAuto"
echo "2. 🚗 Navigate to inventory page"
echo "3. 🔍 Apply filters to limit results"
echo "4. 📋 Select first vehicle from list"
echo "5. ⚙️  Open Factory Equipment tab"
echo "6. ☑️  Test checkbox interactions (check/uncheck)"
echo ""
echo "The test runs with visible browser and pauses between steps"
echo "for manual verification."
echo ""

# Check if credentials are set
if [ -z "$VAUTO_USERNAME" ] || [ -z "$VAUTO_PASSWORD" ]; then
    echo "❌ ERROR: VAuto credentials not found in environment"
    echo "Please set VAUTO_USERNAME and VAUTO_PASSWORD environment variables"
    echo ""
    echo "Example:"
    echo "export VAUTO_USERNAME='your_username'"
    echo "export VAUTO_PASSWORD='your_password'"
    exit 1
fi

echo "✅ Credentials found"
echo ""

# Set test environment variables
export HEADLESS=false
export SLOW_MO=1000
export SCREENSHOT_ON_ERROR=true
export LOG_LEVEL=debug
export BROWSER_TIMEOUT=30000

# Create screenshots directory if it doesn't exist
mkdir -p screenshots

echo "🚀 Starting inventory flow test..."
echo "   Browser will be visible for monitoring"
echo "   Screenshots will be saved to screenshots/ directory"
echo "   Press Ctrl+C to stop at any time"
echo ""

# Run the test
ts-node tests/test-inventory-flow.ts

echo ""
echo "✅ Test completed!"
echo "📸 Check screenshots/ directory for step-by-step screenshots"
echo "📋 Review the test report above for detailed results"