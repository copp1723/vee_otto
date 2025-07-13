# vAuto Mockup Testing Quick Start Guide

## Overview
This guide helps you launch the vAuto mock HTML UI, run tests, and monitor for failures.

## Quick Start

### Option 1: Manual Testing (Browser)
```bash
# Start the mockup server for manual testing
npm run vauto:mockup-manual
```
- Open http://localhost:3001 in your browser
- Or use the Dashboard in dev mode at http://localhost:5173 (click "Test Mockup" tab)
- Test manually through the UI

### Option 2: Automated Testing with Monitoring
```bash
# Run automated tests with full monitoring
npm run vauto:mockup-test
```
- Tests run automatically with visual browser (not headless)
- All activity is logged to `logs/vauto-test-[timestamp].log`
- Errors are highlighted and summarized

### Option 3: Both Manual and Automated
```bash
# Run tests first, then keep server running for manual testing
npm run vauto:mockup-watch
```

## Test Flow

The mockup simulates the complete vAuto workflow:

1. **Login**: Username → Password → Dealership Selection
2. **Navigation**: Homepage → Pricing Menu → View Inventory
3. **Vehicle Processing**:
   - Click on a vehicle (3 test vehicles available)
   - View window sticker (if available)
   - Edit description (toggle features)
   - Sync book values across J.D. Power, KBB, Black Book
   - Generate report

## Test Vehicles

- **VIN123ABC**: Full flow with window sticker
- **VIN456DEF**: Full flow with different features  
- **VIN789GHI**: No sticker scenario (triggers alert)

## Monitoring Failures

### 1. Real-time Console Output
All test activities are logged with timestamps:
```
[2024-01-10T10:30:45.123Z] [INFO] Starting vAuto mockup server...
[2024-01-10T10:30:46.456Z] [TEST] Testing login flow...
[2024-01-10T10:30:47.789Z] [ERROR] Login flow failed: Element not found
```

### 2. Log Files
Check `logs/vauto-test-[timestamp].log` for:
- Complete test execution history
- Detailed error messages
- Performance metrics

### 3. Screenshots on Failure
When tests fail, screenshots are saved as `error-[VIN].png`

### 4. Error Summary
At the end of each test run, all errors are summarized

## Debugging Tips

### If Tests Fail:

1. **Check Element Visibility**
   - Run with `npm run vauto:mockup-manual` to see the UI
   - Verify elements are visible and clickable

2. **Review Timing Issues**
   - Tests have a 500ms slowMo for visual inspection
   - Add more wait times if needed

3. **Inspect Console Logs**
   - Browser console messages are captured
   - Look for JavaScript errors

4. **Use Screenshots**
   - Error screenshots show the exact state when failure occurred
   - Compare with expected UI state

### Common Issues:

1. **Port 3001 in use**: Kill any process using port 3001
   ```bash
   lsof -ti:3001 | xargs kill -9
   ```

2. **Express not found**: Install dependencies
   ```bash
   npm install express
   ```

3. **TypeScript errors**: Make sure TypeScript is installed
   ```bash
   npm install -D typescript ts-node @types/node
   ```

## Advanced Usage

### Custom Test Scenarios
Edit `tests/fixtures/vauto-mockup/index.html` to add new vehicles or scenarios.

### Adjust Test Speed
Edit `tests/test-vauto-mockup.ts` and change the `slowMo` value:
```typescript
this.browser = await chromium.launch({
  headless: false,
  slowMo: 1000 // Slower for debugging
});
```

### Run Specific Tests
Modify the test file to skip certain vehicles or flows.

## Integration with CI/CD

For automated testing in CI:
1. Set `headless: true` in the test file
2. Remove `slowMo` for faster execution
3. Use the test command: `npm run vauto:mockup-test`

## Need Help?

- Check the full documentation: `tests/fixtures/vauto-mockup/README.md`
- Review test implementation: `tests/test-vauto-mockup.ts`
- Check logs in the `logs/` directory 