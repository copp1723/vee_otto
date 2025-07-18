#!/bin/bash

echo "🚀 VAuto MVP End-to-End Automation"
echo "=================================="
echo ""

# Default values
HEADLESS=${HEADLESS:-false}
MAX_VEHICLES=${MAX_VEHICLES:-5}
MAX_PAGES=${MAX_PAGES:-1}
SLOW_MO=${SLOW_MO:-1000}

# Display configuration
echo "📋 Configuration:"
echo "  - HEADLESS: $HEADLESS"
echo "  - MAX_VEHICLES: $MAX_VEHICLES"
echo "  - MAX_PAGES: $MAX_PAGES"
echo "  - SLOW_MO: $SLOW_MO ms"
echo ""

# Check for required environment variables
if [ -z "$VAUTO_USERNAME" ] || [ -z "$VAUTO_PASSWORD" ]; then
    echo "❌ Error: VAUTO_USERNAME and VAUTO_PASSWORD must be set"
    echo ""
    echo "Usage:"
    echo "  export VAUTO_USERNAME='your-username'"
    echo "  export VAUTO_PASSWORD='your-password'"
    echo "  ./scripts/run-mvp.sh"
    echo ""
    echo "Optional environment variables:"
    echo "  HEADLESS=true        # Run in headless mode"
    echo "  MAX_VEHICLES=10      # Process max 10 vehicles"
    echo "  MAX_PAGES=2          # Process max 2 pages"
    echo "  SLOW_MO=500          # Set action delay in ms"
    exit 1
fi

# Create required directories
mkdir -p screenshots/mvp
mkdir -p reports/mvp
mkdir -p session
mkdir -p logs

# Run the MVP script
echo "🎯 Starting MVP automation..."
echo ""

# Export variables for the Node process
export HEADLESS
export MAX_VEHICLES
export MAX_PAGES
export SLOW_MO

# Run with timestamps
npx ts-node scripts/run-mvp-end-to-end.ts 2>&1 | tee "logs/mvp-$(date +%Y%m%d-%H%M%S).log"

# Check exit code
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ MVP automation completed successfully!"
    echo "📊 Check reports/mvp/ for detailed results"
else
    echo ""
    echo "❌ MVP automation failed!"
    echo "📸 Check screenshots/mvp/ for debug screenshots"
    echo "📄 Check logs/ for detailed error logs"
    exit 1
fi