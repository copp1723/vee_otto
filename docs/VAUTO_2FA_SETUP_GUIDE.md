# VAuto 2FA Setup Guide

## Overview
This guide documents the complete process for setting up 2FA authentication in VAuto and integrating it with the VeeOtto SMS webhook system.

## Prerequisites
- VAuto account with admin access
- Twilio account configured with VeeOtto
- VeeOtto deployed on Render
- Phone number: +1 313 765 8345 (configured in system)

## Step-by-Step VAuto 2FA Configuration

### 1. Initial Login to VAuto
1. Navigate to https://signin.coxautoinc.com
2. Enter your VAuto credentials
3. Complete initial authentication

### 2. Access Security Settings
1. Once logged in, navigate to **Settings**
2. Look for **Security** or **Account Security** section
3. Find **Multi-Factor Authentication** or **2FA** options

### 3. Configure 2FA Settings
1. Select **Configure** or **Enable** 2FA
2. Choose **SMS/Text Message** as the authentication method
3. Enter phone number: **+1 313 765 8345**
4. Verify the phone number format is correct

### 4. Phone Number Verification
1. Click **Send Verification Code**
2. VAuto will send SMS to +1 313 765 8345
3. Use VeeOtto tools to retrieve the code:
   ```bash
   node check-twilio-logs.js
   # Look for most recent message with 6-digit code
   ```

### 5. Complete 2FA Setup
1. Enter the 6-digit verification code in VAuto
2. Confirm 2FA is enabled
3. Save security settings

## SMS Code Format
VAuto sends SMS codes in this format:
```
One-time Bridge ID code: 768932. Code expires in 5 minutes. Un code horaire expire dans 5 minutes.
```

## VeeOtto Integration

### Automated Code Retrieval
The VeeOtto system automatically:
1. Receives SMS via Twilio webhook
2. Extracts 6-digit codes using regex: `\b(\d{6})\b`
3. Stores codes for 5 minutes (matching VAuto expiration)
4. Provides API endpoint for code retrieval

### Available Tools
```bash
# Check for latest 2FA code
node get-sms-code.js

# View all recent SMS messages
node check-twilio-logs.js

# Monitor deployment status
node monitor-deployment.js
```

### API Endpoints
- **SMS Webhook**: `https://vee-otto-api.onrender.com/webhooks/twilio/sms`
- **Get Latest Code**: `https://vee-otto-api.onrender.com/api/2fa/latest`

## Troubleshooting

### Code Not Received
1. Check Twilio logs: `node check-twilio-logs.js`
2. Verify webhook URL configuration in Twilio console
3. Ensure phone number +1 313 765 8345 is correct in VAuto

### Webhook Issues
1. Test webhook endpoint:
   ```bash
   curl https://vee-otto-api.onrender.com/api/2fa/latest
   ```
2. Expected response: `{"error":"No 2FA code received yet"}` (when no codes)
3. With code: `{"code":"768932","timestamp":"2025-07-13T03:05:08.000Z"}`

### Code Expiration
- VAuto codes expire in 5 minutes
- VeeOtto automatically removes expired codes
- Request new code if current one expired

## Security Notes
- Phone number +1 313 765 8345 is dedicated for VAuto 2FA
- All SMS messages are logged in Twilio for audit purposes
- Codes are automatically purged after 5 minutes for security
- Webhook validates Twilio signatures to prevent unauthorized access

## Success Indicators
✅ VAuto shows 2FA enabled in security settings
✅ SMS codes arrive at +1 313 765 8345
✅ Twilio logs show incoming messages
✅ VeeOtto can retrieve codes via API
✅ Automation can proceed with 2FA authentication

## Next Steps
With 2FA configured, the VeeOtto automation system can now:
1. Automatically handle VAuto login with 2FA
2. Retrieve SMS codes when prompted
3. Complete authentication flow without manual intervention
4. Process inventory automation tasks seamlessly