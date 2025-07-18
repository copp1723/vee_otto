# Quick Debug Commands - Copy & Paste Ready

## 🚀 Initial Setup
```bash
# Install dependencies
npm install

# Create required directories
mkdir -p screenshots/mvp reports/mvp session logs debug-data

# Set credentials (replace with actual)
export VAUTO_USERNAME="Jcopp"
export VAUTO_PASSWORD="htu9QMD-wtkjpt6qak"
```

## 🧪 Test Commands (Run in Order)

### 1. Test Basic Setup
```bash
npx ts-node scripts/test-mvp-basics.ts
```

### 2. Test Parsing Logic (No Login Required)
```bash
npx ts-node scripts/test-parsing-logic.ts
```

### 3. Test Login Only
```bash
HEADLESS=false npx ts-node scripts/test-login-only.ts
```

### 4. Test Step by Step (Interactive)
```bash
HEADLESS=false npx ts-node scripts/test-mvp-step-by-step.ts
```

### 5. Run MVP with 1 Vehicle
```bash
HEADLESS=false MAX_VEHICLES=1 SLOW_MO=2000 ./scripts/run-mvp.sh
```

## 🐛 Debug Specific Issues

### Vehicle Not Clicking
```bash
# Test just vehicle clicking
npx ts-node scripts/modules/03-click-vehicle.ts

# Debug with screenshots
HEADLESS=false SLOW_MO=3000 npx ts-node scripts/debug-vehicle-clicking.ts
```

### Factory Equipment Not Working
```bash
# Test factory equipment standalone
npx ts-node scripts/modules/04-click-factory-equipment.ts

# Debug factory equipment
HEADLESS=false npx ts-node scripts/test-factory-equipment-only.ts
```

### Window Sticker Issues
```bash
# Test window sticker access
HEADLESS=false npx ts-node scripts/test-window-sticker-and-checkboxes.ts
```

## 📊 Check Results

### View Latest Report
```bash
# Find latest report
ls -la reports/mvp/mvp-report-*.json | tail -1

# Pretty print report
cat reports/mvp/mvp-report-*.json | jq '.'

# Summary only
cat reports/mvp/mvp-report-*.json | jq '{total: .totalVehicles, success: .successful, failed: .failed}'
```

### View Logs
```bash
# Latest log
tail -f logs/mvp-*.log

# Search for errors
grep -i error logs/mvp-*.log

# Search for specific vehicle
grep -i "vin: 1C4RJKBG5S8733448" logs/mvp-*.log
```

### View Screenshots
```bash
# List all screenshots
ls -la screenshots/mvp/

# Open latest error screenshot
open screenshots/mvp/error-*.png  # macOS
# or
xdg-open screenshots/mvp/error-*.png  # Linux
```

## 🔧 Quick Fixes

### Clear All Data
```bash
rm -rf session/* screenshots/mvp/* reports/mvp/* logs/*
```

### Reset Session Only
```bash
rm -f session/auth-session.json
```

### Update Selectors
```bash
# Edit selectors file
code platforms/vauto/vautoSelectors.ts

# Test selectors
npx ts-node scripts/test-selectors.ts
```

### Fix TypeScript Errors
```bash
# Check for errors
npx tsc --noEmit

# Run with transpile only (skip type checking)
npx ts-node --transpile-only scripts/run-mvp-end-to-end.ts
```

## 🏃‍♂️ Production Commands

### Run in Background
```bash
# With nohup
nohup ./scripts/run-mvp.sh > mvp.log 2>&1 &

# Check if running
ps aux | grep mvp

# Watch log
tail -f mvp.log
```

### Run with Full Configuration
```bash
VAUTO_USERNAME="Jcopp" \
VAUTO_PASSWORD="htu9QMD-wtkjpt6qak" \
HEADLESS=true \
MAX_VEHICLES=50 \
MAX_PAGES=5 \
SLOW_MO=1000 \
LOG_LEVEL=info \
./scripts/run-mvp.sh
```

### Run with Webhook for 2FA
```bash
WEBHOOK_URL="https://vee-otto-api.onrender.com/webhook/sms" \
TWO_FACTOR_METHOD="sms" \
TWO_FACTOR_PHONE="+13137658345" \
./scripts/run-mvp.sh
```

## 📱 Monitor Progress

### Watch in Real Time
```bash
# Terminal 1: Run MVP
./scripts/run-mvp.sh

# Terminal 2: Watch screenshots
watch -n 2 'ls -la screenshots/mvp/ | tail -5'

# Terminal 3: Monitor log
tail -f logs/mvp-*.log | grep -E "(Processing vehicle|✅|❌)"
```

### Create Summary Report
```bash
# Count successes/failures
echo "Success: $(grep -c "✅ Vehicle processed" logs/mvp-*.log)"
echo "Failed: $(grep -c "❌ Failed to process" logs/mvp-*.log)"
echo "Features Found: $(grep -o "Found [0-9]* features" logs/mvp-*.log | awk '{sum+=$2} END {print sum}')"
echo "Checkboxes Updated: $(grep -o "Updated [0-9]* checkboxes" logs/mvp-*.log | awk '{sum+=$2} END {print sum}')"
```

## 🆘 Emergency Commands

### Kill Stuck Process
```bash
# Find process
ps aux | grep -E "(chromium|mvp|ts-node)"

# Kill by PID
kill -9 <PID>

# Kill all chromium
pkill -f chromium
```

### Debug Network Issues
```bash
# Test VAuto connectivity
curl -I https://login.vauto.com
curl -I https://app.vauto.com

# Check DNS
nslookup login.vauto.com
```

### Check System Resources
```bash
# Memory usage
free -h

# Disk space
df -h

# CPU usage
top
```

Remember: Start with `HEADLESS=false` and `MAX_VEHICLES=1` for debugging!