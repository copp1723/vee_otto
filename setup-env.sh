#!/bin/bash

# VAuto Automation Environment Setup
# Source this file to set up your environment: source ./setup-env.sh

echo "🔧 Setting up VAuto automation environment..."

# Set credentials
export VAUTO_USERNAME="Jcopp"
export VAUTO_PASSWORD="htu9QMD-wtkjpt6qak"

# Set default configuration
export HEADLESS=true
export MAX_VEHICLES=100
export MAX_PAGES=10
export SLOW_MO=1000
export LOG_LEVEL=info
export SCREENSHOT_ON_FAILURE=true

# Optional: Set monitoring/alerting (commented out by default)
# export WEBHOOK_URL="your-webhook-url"
# export EMAIL_RECIPIENTS="email@example.com"

echo "✅ Environment configured!"
echo ""
echo "Available commands:"
echo "  ./scripts/health-check.sh         - Check system readiness"
echo "  ./scripts/run-mvp.sh             - Run with current settings"
echo "  ./scripts/run-production.sh      - Run full production (100 vehicles)"
echo "  ./scripts/monitor-dashboard.ts   - Real-time monitoring"
echo ""
echo "Quick test commands:"
echo "  MAX_VEHICLES=1 HEADLESS=false ./scripts/run-mvp.sh  - Test 1 vehicle with UI"
echo "  MAX_VEHICLES=5 ./scripts/run-mvp.sh                 - Test 5 vehicles headless"
echo ""