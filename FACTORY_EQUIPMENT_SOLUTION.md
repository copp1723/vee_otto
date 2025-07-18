# Factory Equipment Navigation Solution

## Problem Summary
The vehicle modal sometimes opens on different tabs (Pricing, Media, etc.) instead of Vehicle Info tab. The Factory Equipment button is **only** visible on the Vehicle Info tab.

## Working Solution
The complete working solution is in `fix-vehicle-info-tab-click.ts` which provides two key functions:

### 1. `ensureVehicleInfoTab(page, logger)`
- Checks if already on Vehicle Info tab
- If not, clicks the Vehicle Info tab using multiple selector strategies
- Verifies the tab switch was successful

### 2. `clickFactoryEquipmentWithTabCheck(page, logger)`
- First ensures Vehicle Info tab is active
- Then clicks the Factory Equipment button
- Uses the correct button ID: `#ext-gen199`

## Key Selectors

### Vehicle Info Tab
```javascript
'text="Vehicle Info"'
'//span[contains(text(), "Vehicle Info")]'
'//div[contains(@class, "x-tab")]//span[contains(text(), "Vehicle Info")]'
```

### Factory Equipment Button
```javascript
'#ext-gen199'  // Primary - exact ID
'text="Factory Equipment"'  // Fallback - text selector
'//button[@id="ext-gen199"]'  // XPath with ID
```

## Integration Example

```typescript
// Import the working solution
import { clickFactoryEquipmentWithTabCheck } from './fix-vehicle-info-tab-click';

// In your workflow, after opening the vehicle modal:
const success = await clickFactoryEquipmentWithTabCheck(page, logger);

if (success) {
  // Factory Equipment was clicked successfully
  // Check for new window or continue with window sticker parsing
}
```

## Important Notes

1. **Factory Equipment is NOT a tab** - it's a button on the Vehicle Info tab
2. **Two-step process is required**:
   - Step 1: Navigate to Vehicle Info tab (if not already there)
   - Step 2: Click Factory Equipment button
3. **The button ID is consistent**: `#ext-gen199` is always in the same spot
4. **Modal state matters**: Ensure the modal (`.x-window`) is visible before attempting navigation

## Testing

To test with an existing session:
```bash
npm run test:with-session test-factory-equipment-with-session.ts
```

## Debugging

If the navigation fails:
1. Check if the modal is visible: `.x-window`
2. Verify you can see the tab bar with Vehicle Info, Pricing, etc.
3. Look for the Factory Equipment button: `#ext-gen199`
4. Screenshots are saved automatically for debugging

## Common Issues and Solutions

### Issue: "Cannot find Vehicle Info tab"
- The modal might not be fully loaded
- Add wait: `await page.waitForSelector('.x-window', { state: 'visible' })`

### Issue: "Factory Equipment button not found"
- You're not on the Vehicle Info tab
- The button ID might have changed (check with browser inspector)

### Issue: "Click succeeded but nothing happened"
- Check if a new window opened: `page.context().pages()`
- The window sticker might load inline instead of in a new window