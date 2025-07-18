# MVP Testing Plan

## Pre-Flight Checks

1. **Verify Dependencies**
   ```bash
   # Check if all imports resolve
   npx tsc --noEmit scripts/run-mvp-end-to-end.ts
   ```

2. **Check Environment**
   ```bash
   # Ensure credentials are set
   echo "Username: $VAUTO_USERNAME"
   echo "Password set: $([ -n "$VAUTO_PASSWORD" ] && echo "Yes" || echo "No")"
   ```

## Step-by-Step Testing

### Test 1: Syntax and Import Check
```bash
# Just compile, don't run
npx ts-node --transpile-only -e "console.log('TypeScript works')"
npx ts-node --transpile-only scripts/run-mvp-end-to-end.ts --help 2>&1 | head -20
```

### Test 2: Single Vehicle Test
```bash
# Run with maximum visibility and just 1 vehicle
HEADLESS=false MAX_VEHICLES=1 MAX_PAGES=1 SLOW_MO=2000 ./scripts/run-mvp.sh
```

### Test 3: Dry Run Mode
First, let me add a dry-run mode to the script for safer testing...

## Known Issues to Check

1. **Import Paths** - Some services might have incorrect import paths
2. **Selectors** - The actual selectors might have changed since the code was written
3. **Navigation Flow** - The return to inventory logic might need adjustment

## What to Watch For

1. **Login Phase**
   - Does it find the username/password fields?
   - Does 2FA prompt appear?
   - Does session save work?

2. **Inventory Navigation**
   - Does the inventory page load?
   - Can it find the filter tab?
   - Does the age filter apply correctly?

3. **Vehicle Clicking**
   - Are vehicle rows found?
   - Does clicking open the modal?
   - Is the VIN extracted correctly?

4. **Factory Equipment**
   - Does the Factory Equipment button appear?
   - Does clicking it work?
   - Is window sticker content accessible?

5. **Checkbox Updates**
   - Are checkboxes found?
   - Do they update correctly?
   - Does save work?

## Quick Fixes for Common Issues

### If imports fail:
```typescript
// Update import paths in run-mvp-end-to-end.ts
import { VehicleModalNavigationService } from '../platforms/vauto/services/VehicleModalNavigationService';
// might need to be:
import { VehicleModalNavigationService } from './platforms/vauto/services/VehicleModalNavigationService';
```

### If selectors fail:
- Run in headed mode (HEADLESS=false)
- Take screenshots at failure points
- Use browser DevTools to find correct selectors

### If navigation fails:
- Add more wait times
- Check for iframes
- Verify modal detection logic