# Development Scripts

This directory contains development and testing utilities that were moved from the root directory during repository cleanup.

## Scripts

### SMS/Webhook Development Tools
- `test-webhook-local.js` - Local webhook testing utility
- `setup-sms-verification.js` - SMS verification setup helper
- `get-sms-code.js` - SMS code retrieval utility
- `setup-ngrok.js` - ngrok setup instructions
- `test-2fa-flow.js` - 2FA flow debugging and testing

### Repository Management
- `apply-fixes.sh` - Git commit helper for applying fixes

## Usage

These scripts are primarily for development and debugging purposes. They can be run from the project root:

```bash
# Example: Get SMS verification codes
node scripts/dev/get-sms-code.js

# Example: Test 2FA flow
npm run test:2fa
```

## Note

These scripts were moved here during repository cleanup to reduce root directory clutter while preserving functionality. All documentation references have been updated to point to the new locations.