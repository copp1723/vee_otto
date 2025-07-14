#!/bin/bash

echo "🚀 VAuto Full Workflow Runner"
echo "============================="
echo ""

# Default values
MAX_VEHICLES="${MAX_VEHICLES:-0}"
READ_ONLY="${READ_ONLY:-false}"
HEADLESS="${HEADLESS:-false}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --max-vehicles)
            MAX_VEHICLES="$2"
            shift 2
            ;;
        --read-only)
            READ_ONLY="true"
            shift
            ;;
        --headless)
            HEADLESS="true"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --max-vehicles <n>  Process only n vehicles (default: all)"
            echo "  --read-only         Skip checkbox updates (default: false)"
            echo "  --headless          Run in headless mode (default: false)"
            echo "  --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                          # Process all vehicles"
            echo "  $0 --max-vehicles 5         # Process 5 vehicles"
            echo "  $0 --read-only              # View-only mode"
            echo "  $0 --max-vehicles 10 --headless  # Process 10 vehicles headless"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Export environment variables
export MAX_VEHICLES_TO_PROCESS="$MAX_VEHICLES"
export READ_ONLY_MODE="$READ_ONLY"
export HEADLESS="$HEADLESS"

# Show configuration
echo "📋 Configuration:"
echo "  Max Vehicles: ${MAX_VEHICLES:-All}"
echo "  Read-Only Mode: $READ_ONLY"
echo "  Headless: $HEADLESS"
echo ""

# Check for required environment variables
if [ -z "$VAUTO_USERNAME" ] || [ -z "$VAUTO_PASSWORD" ]; then
    echo "❌ Error: Missing required environment variables"
    echo ""
    echo "Please set the following:"
    echo "  export VAUTO_USERNAME='your_username'"
    echo "  export VAUTO_PASSWORD='your_password'"
    echo ""
    exit 1
fi

# Create directories if they don't exist
mkdir -p screenshots
mkdir -p reports
mkdir -p logs

# Run the workflow
echo "🔄 Starting workflow..."
echo ""

npm run vauto:process-inventory

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Workflow completed successfully!"
    echo ""
    echo "📄 Reports available in ./reports/"
    
    # Show latest report
    LATEST_HTML=$(ls -t reports/*.html 2>/dev/null | head -1)
    if [ -n "$LATEST_HTML" ]; then
        echo "📊 View latest report: open $LATEST_HTML"
    fi
else
    echo ""
    echo "❌ Workflow failed. Check logs for details."
    exit 1
fi
