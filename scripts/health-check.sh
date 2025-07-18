#!/bin/bash

# VAuto Automation Health Check Script
# Run this before starting production to ensure everything is ready

echo "🏥 VAuto Automation Health Check"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ISSUES=0

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Not installed"
    ((ISSUES++))
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓${NC} $NPM_VERSION"
else
    echo -e "${RED}✗${NC} Not installed"
    ((ISSUES++))
fi

# Check TypeScript
echo -n "Checking TypeScript... "
if npx tsc --version &> /dev/null; then
    TSC_VERSION=$(npx tsc --version)
    echo -e "${GREEN}✓${NC} $TSC_VERSION"
else
    echo -e "${RED}✗${NC} Not installed"
    ((ISSUES++))
fi

# Check dependencies
echo -n "Checking dependencies... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} Installed"
else
    echo -e "${RED}✗${NC} Not installed (run: npm install)"
    ((ISSUES++))
fi

# Check Playwright browsers
echo -n "Checking Playwright browsers... "
if npx playwright --version &> /dev/null; then
    echo -e "${GREEN}✓${NC} Installed"
else
    echo -e "${YELLOW}⚠${NC} May need installation (run: npx playwright install)"
fi

# Check environment variables
echo ""
echo "Environment Variables:"
echo -n "  VAUTO_USERNAME: "
if [ ! -z "$VAUTO_USERNAME" ]; then
    echo -e "${GREEN}✓${NC} Set"
else
    echo -e "${RED}✗${NC} Not set"
    ((ISSUES++))
fi

echo -n "  VAUTO_PASSWORD: "
if [ ! -z "$VAUTO_PASSWORD" ]; then
    echo -e "${GREEN}✓${NC} Set"
else
    echo -e "${RED}✗${NC} Not set"
    ((ISSUES++))
fi

# Check directories
echo ""
echo "Required Directories:"
for dir in "screenshots/mvp" "reports/mvp" "session" "logs"; do
    echo -n "  $dir: "
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} Exists"
    else
        echo -e "${YELLOW}⚠${NC} Missing (will be created)"
        mkdir -p "$dir"
    fi
done

# Check disk space
echo ""
echo -n "Disk Space: "
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_FREE=$(df -h . | awk 'NR==2 {print $4}')
if [ $DISK_USAGE -lt 90 ]; then
    echo -e "${GREEN}✓${NC} $DISK_FREE free"
else
    echo -e "${RED}✗${NC} Low space: $DISK_FREE free"
    ((ISSUES++))
fi

# Check memory
echo -n "Memory: "
if command -v free &> /dev/null; then
    MEM_AVAILABLE=$(free -h | awk 'NR==2 {print $7}')
    echo -e "${GREEN}✓${NC} $MEM_AVAILABLE available"
else
    echo -e "${YELLOW}⚠${NC} Cannot check"
fi

# Test TypeScript compilation
echo ""
echo -n "TypeScript Compilation: "
if npx tsc --noEmit scripts/run-mvp-end-to-end.ts &> /dev/null; then
    echo -e "${GREEN}✓${NC} No errors"
else
    echo -e "${RED}✗${NC} Compilation errors found"
    ((ISSUES++))
fi

# Test network connectivity
echo -n "VAuto Connectivity: "
# Try multiple VAuto URLs
VAUTO_REACHABLE=false
for URL in "https://signin.coxautoinc.com" "https://login.vauto.com/" "https://app.vauto.com/"; do
    if curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null | grep -q "200\|301\|302\|403"; then
        VAUTO_REACHABLE=true
        break
    fi
done

if [ "$VAUTO_REACHABLE" = true ]; then
    echo -e "${GREEN}✓${NC} Reachable"
else
    echo -e "${RED}✗${NC} Cannot reach VAuto"
    ((ISSUES++))
fi

# Check for recent successful runs
echo ""
echo -n "Recent Runs: "
if [ -d "reports/mvp" ] && [ "$(ls -A reports/mvp/*.json 2>/dev/null | wc -l)" -gt 0 ]; then
    LATEST_REPORT=$(ls -t reports/mvp/*.json 2>/dev/null | head -1)
    if [ ! -z "$LATEST_REPORT" ]; then
        SUCCESS_RATE=$(jq -r 'if .totalVehicles > 0 then (.successful / .totalVehicles * 100 | floor) else 0 end' "$LATEST_REPORT" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓${NC} Last run: ${SUCCESS_RATE}% success"
    fi
else
    echo -e "${YELLOW}⚠${NC} No previous runs found"
fi

# Summary
echo ""
echo "================================"
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Ready to run production:"
    echo "  ./scripts/run-production.sh"
else
    echo -e "${RED}❌ Found $ISSUES issues${NC}"
    echo ""
    echo "Please fix the issues above before running production."
fi
echo ""

exit $ISSUES