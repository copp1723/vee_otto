#!/bin/bash

echo "🚀 VAuto Window Sticker Test Script"
echo "===================================="
echo ""

# Check if using mockup
if [ "$1" = "mockup" ]; then
    echo "📦 Using VAuto mockup for testing..."
    export VAUTO_MOCKUP=true
    
    # Start mockup server if not running
    if ! lsof -i:5001 > /dev/null 2>&1; then
        echo "Starting VAuto mockup server..."
        npm run serve:vauto-mockup &
        sleep 3
    fi
else
    echo "🌐 Using real VAuto for testing..."
    export VAUTO_MOCKUP=false
fi

# Create screenshots directory if it doesn't exist
mkdir -p screenshots

# Run the window sticker test
echo ""
echo "🔍 Running window sticker scraping test..."
echo ""

npx ts-node tests/test-window-sticker-scraping.ts

echo ""
echo "✅ Test completed! Check screenshots/ directory for visual results."
