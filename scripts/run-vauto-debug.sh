#!/bin/bash

# Run vAuto automation with debug settings
echo "🔍 Running vAuto automation in debug mode..."
echo "This will process 1 vehicle with enhanced logging and screenshots"

# Set debug environment variables
export VAUTO_DEBUG=true
export VAUTO_MAX_VEHICLES=1
export VAUTO_SCREENSHOT_EVERY_STEP=true
export HEADLESS=false
export SLOW_MO=100

# Run the automation using the full workflow script
ts-node scripts/run-full-workflow.ts

echo "✅ Debug run complete. Check logs and screenshots for details."
