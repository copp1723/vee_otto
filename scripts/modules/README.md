# VAuto Modular Automation Scripts

## Overview

These scripts break down the VAuto automation into small, testable modules that each do ONE thing well. This approach allows us to:

1. **Test each step in isolation**
2. **See exactly where failures occur**
3. **Fix issues without breaking working parts**
4. **Resume from any point in the process**

## Modules

### Module 01: Login and 2FA
- **File**: `01-login-and-2fa.ts`
- **Purpose**: Handle login and 2FA authentication ONLY
- **Output**: Saves authenticated session to `session/state.json`
- **Run**: `npx ts-node scripts/modules/01-login-and-2fa.ts`

### Module 02: Navigate to Inventory
- **File**: `02-navigate-to-inventory.ts`
- **Purpose**: Navigate to inventory page and apply saved filter
- **Input**: Uses saved session from Module 01
- **Output**: Saves state to `session/state-after-nav.json`
- **Run**: `npx ts-node scripts/modules/02-navigate-to-inventory.ts`

### Module 03: Click Vehicle
- **File**: `03-click-vehicle.ts`
- **Purpose**: Click on a vehicle link to open details
- **Input**: Uses saved state from Module 02
- **Output**: Saves state to `session/state-vehicle-selected.json`
- **Run**: `npx ts-node scripts/modules/03-click-vehicle.ts`
- **Features**:
  - Tries multiple click strategies
  - Highlights what it's about to click
  - Takes screenshots before/after

### Module 04: Click Factory Equipment
- **File**: `04-click-factory-equipment.ts`
- **Purpose**: Click the Factory Equipment tab
- **Input**: Uses saved state from Module 03
- **Output**: Saves state to `session/state-factory-equipment.json`
- **Run**: `npx ts-node scripts/modules/04-click-factory-equipment.ts`

## Usage

### Run All Modules
```bash
./scripts/modules/run-all-modules.sh
```

### Run Individual Modules
```bash
# Start fresh - login and 2FA
npx ts-node scripts/modules/01-login-and-2fa.ts

# Continue from saved session
npx ts-node scripts/modules/02-navigate-to-inventory.ts

# Debug vehicle clicking
npx ts-node scripts/modules/03-click-vehicle.ts

# Test factory equipment tab
npx ts-node scripts/modules/04-click-factory-equipment.ts
```

## Debugging

1. Each module takes screenshots in the `screenshots/` directory
2. Session states are saved in `session/` directory
3. Each module highlights elements before clicking
4. Detailed logs show what's happening at each step

## Benefits of This Approach

1. **Isolation**: Each step runs independently
2. **Resumability**: Can start from any saved state
3. **Debuggability**: See exactly what fails and why
4. **Flexibility**: Easy to add new strategies or fixes
5. **Visibility**: Screenshots and highlights show what's happening

## Next Steps

Once these core modules work reliably, we can add:
- Module 05: Extract window sticker content
- Module 06: Map features to checkboxes
- Module 07: Save changes
- Module 08: Process next vehicle

Each module will be simple, focused, and testable! 