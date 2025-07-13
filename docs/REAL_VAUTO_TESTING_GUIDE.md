# Real VAuto Testing Guide

## 🧪 **How to Test with Real VAuto Platform**

### **1. Prerequisites**

Before testing with the real VAuto platform, ensure you have:

- ✅ **VAuto credentials** configured in environment variables
- ✅ **Twilio SMS setup** for 2FA (phone number: +1 313 765 8345)
- ✅ **SMS webhook** deployed and accessible
- ✅ **Test environment** ready with safety settings

### **2. Safe Testing Commands**

#### **Option A: Use the Safe Testing Script (Recommended)**
```bash
# Set your credentials first
export VAUTO_USERNAME="your_username"
export VAUTO_PASSWORD="your_password"
export DEALERSHIP_ID="your_dealership_id"

# Run the safe test script
./scripts/test-vauto-safely.sh
```

#### **Option B: Manual Environment Setup**
```bash
# Set credentials
export VAUTO_USERNAME="your_username"
export VAUTO_PASSWORD="your_password"
export DEALERSHIP_ID="your_dealership_id"

# Set safety environment variables
export TEST_MODE=true
export HEADLESS=false
export SLOW_MO=1000
export DRY_RUN=true
export READ_ONLY_MODE=true
export MAX_VEHICLES_TO_PROCESS=1
export STOP_ON_FIRST_ERROR=true

# Run test
npm run vauto:once
```

#### **Option C: Test Specific Components**
```bash
# Test login only
npm run test:vauto

# Test with visible browser
HEADLESS=false npm run vauto:once

# Test with slower operations
SLOW_MO=2000 npm run vauto:once
```

### **3. Safety Mechanisms**

The system includes several safety mechanisms to prevent unwanted changes:

#### **Environment Variable Controls**
- `DRY_RUN=true` - Simulates operations without saving
- `READ_ONLY_MODE=true` - Only reads data, no modifications
- `MAX_VEHICLES_TO_PROCESS=1` - Limits processing to 1 vehicle
- `STOP_ON_FIRST_ERROR=true` - Stops on first error
- `HEADLESS=false` - Shows browser for monitoring

#### **Built-in Safeguards**
- **Screenshot capture** on errors for debugging
- **Detailed logging** of all operations
- **Error handling** with graceful failures
- **Timeout controls** to prevent hanging

### **4. What to Expect During Testing**

#### **Phase 1: Login & Authentication**
```
🔐 Starting vAuto login process
📱 2FA SMS sent to +1 313 765 8345
✅ Login successful
```

#### **Phase 2: Navigation**
```
🧭 Navigating to inventory
🔍 Applying inventory filters (age 0-1 days)
📋 Found X vehicles matching criteria
```

#### **Phase 3: Vehicle Processing (Safe Mode)**
```
🔒 SAFE MODE: Processing vehicle 1/1
📄 Extracting window sticker content
🔍 Found X features in window sticker
🔒 SAFE MODE: DRY RUN - Would update features (but not actually saving)
✅ Successfully processed vehicle [VIN]
```

#### **Phase 4: Completion**
```
✅ SAFE MODE: Inventory processing completed
📊 Processed: 1 vehicles
📊 Successful: 1 vehicles
📊 Failed: 0 vehicles
```

### **5. Monitoring During Test**

#### **Browser Window**
- **Visible browser** shows all operations in real-time
- **Slow motion** (1000ms) allows you to see each step
- **Screenshots** saved on errors for debugging

#### **Console Output**
- **Detailed logs** show exactly what's happening
- **Safety warnings** indicate dry-run/read-only mode
- **Error messages** with context and suggestions

#### **SMS Notifications**
- **2FA codes** sent to +1 313 765 8345
- **Webhook processing** retrieves codes automatically
- **Login completion** without manual intervention

### **6. Troubleshooting**

#### **Common Issues**

**Login Fails**
```bash
# Check credentials
echo $VAUTO_USERNAME
echo $VAUTO_PASSWORD

# Test SMS webhook
node check-twilio-logs.js
```

**2FA Not Working**
```bash
# Check SMS webhook
curl https://vee-otto-api.onrender.com/api/2fa/latest

# Monitor deployment
node monitor-deployment.js
```

**Browser Issues**
```bash
# Run with visible browser
HEADLESS=false npm run vauto:once

# Increase timeout
BROWSER_TIMEOUT=60000 npm run vauto:once
```

#### **Debug Mode**
```bash
# Enable verbose logging
LOG_LEVEL=debug npm run vauto:once

# Save screenshots on all steps
SCREENSHOT_ON_FAILURE=true npm run vauto:once
```

### **7. What Should Be Completed**

#### **Expected Workflow Completion**
1. ✅ **Login** - Successfully authenticate with 2FA
2. ✅ **Navigation** - Reach inventory page with filters applied
3. ✅ **Vehicle Discovery** - Find vehicles aged 0-1 days
4. ✅ **Feature Extraction** - Read window sticker content
5. ✅ **Feature Analysis** - Parse and identify vehicle features
6. ✅ **Simulation** - Show what would be updated (dry run)
7. ✅ **Reporting** - Generate detailed test report

#### **What WON'T Happen (Safety)**
- ❌ **No actual changes** saved to VAuto (dry run mode)
- ❌ **No checkbox updates** (read-only mode)
- ❌ **No email reports** sent (disabled for testing)
- ❌ **No multiple vehicles** processed (limited to 1)

### **8. Post-Test Analysis**

#### **Check These Files**
```bash
# Screenshots (if any errors)
ls -la screenshots/

# Logs
tail -f logs/agent.log

# Test report (console output)
# The script will show a detailed summary
```

#### **Success Indicators**
- ✅ Login completed without errors
- ✅ 2FA handled automatically
- ✅ Vehicle found and processed
- ✅ Features extracted from window sticker
- ✅ Dry run simulation completed
- ✅ No actual changes made to VAuto

### **9. Next Steps After Successful Test**

1. **Review the test report** for any issues
2. **Check screenshots** for visual verification
3. **Analyze extracted features** for accuracy
4. **Plan production deployment** with real settings
5. **Configure email notifications** for production

### **10. Production vs Test Mode**

| Setting | Test Mode | Production Mode |
|---------|-----------|-----------------|
| `DRY_RUN` | `true` | `false` |
| `READ_ONLY_MODE` | `true` | `false` |
| `MAX_VEHICLES_TO_PROCESS` | `1` | `unlimited` |
| `HEADLESS` | `false` | `true` |
| `SLOW_MO` | `1000` | `100` |
| `STOP_ON_FIRST_ERROR` | `true` | `false` |

### **11. Emergency Stop**

If you need to stop the test immediately:
```bash
# Press Ctrl+C in the terminal
# The browser will close automatically
# No changes will be saved (dry run mode)
```

---

## 🎯 **Summary**

This testing approach ensures you can safely validate the VAuto automation without making any changes to your live data. The system will:

1. **Login safely** with 2FA
2. **Navigate** to the correct pages
3. **Extract** vehicle information
4. **Simulate** what would be updated
5. **Report** detailed results
6. **Preserve** all existing data

**No changes will be saved to VAuto during testing!** 