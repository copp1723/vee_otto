# Staging Deployment Environment Variables Checklist

## 🚨 **IMMEDIATE ACTION REQUIRED**

### 1. **Security Fixes (CRITICAL)**
- [ ] **Remove sensitive credentials from `.env`** - Move to environment secrets
- [ ] **Generate secure JWT_SECRET** (32+ characters)
- [ ] **Change ADMIN_PASS** from `password123` to secure password
- [ ] **Never commit `.env` with real credentials** to version control

### 2. **Environment Secrets Setup**
Configure these as environment variables (not in .env file):
```bash
export VAUTO_USERNAME="your_actual_username"
export VAUTO_PASSWORD="your_actual_password"
export TWILIO_ACCOUNT_SID="your_twilio_sid"
export TWILIO_AUTH_TOKEN="your_twilio_token"
export OPENROUTER_API_KEY="your_openrouter_key"
export MAILGUN_API_KEY="your_mailgun_key"
export MAILGUN_DOMAIN="your_mailgun_domain"
```

## ✅ **STAGING CONFIGURATION CHECKLIST**

### 3. **Core Settings**
- [ ] Set `NODE_ENV=staging`
- [ ] Set `HEADLESS=true` for server environment
- [ ] Set `LOG_LEVEL=warn` (reduces verbose logging)
- [ ] Set `DASHBOARD_INTEGRATION=true` if using dashboard

### 4. **URL Configuration**
Replace localhost URLs with staging URLs:
- [ ] `FRONTEND_URL` → Your staging frontend URL
- [ ] `REACT_APP_API_URL` → Your staging API URL  
- [ ] `REACT_APP_WS_URL` → Your staging WebSocket URL
- [ ] `PUBLIC_URL` → Your staging public URL
- [ ] `WEBHOOK_URL` → Your staging webhook URL

### 5. **Email/SMS Configuration**
- [ ] Verify **Mailgun credentials** are valid
- [ ] Test **Twilio SMS** functionality
- [ ] Configure **SMTP settings** for notifications
- [ ] Set proper **notification email addresses**

### 6. **2FA Setup**
- [ ] Confirm `ENABLE_2FA=true`
- [ ] Set `TWO_FACTOR_METHOD=sms` (recommended for automation)
- [ ] Verify phone number format: `+1XXXXXXXXXX`

### 7. **Performance Settings**
- [ ] Set appropriate `BROWSER_TIMEOUT` (30000ms recommended)
- [ ] Configure `DEFAULT_RETRIES=3`
- [ ] Enable `SCREENSHOT_ON_FAILURE=true` for debugging

## 🔒 **SECURITY BEST PRACTICES**

### 8. **Credential Management**
```bash
# Use a secret management tool or environment variables
# Never hardcode in .env files

# Example with Docker secrets:
docker secret create vauto_password /path/to/password/file

# Example with Kubernetes secrets:
kubectl create secret generic vauto-credentials \
  --from-literal=username=your_username \
  --from-literal=password=your_password
```

### 9. **File Permissions**
```bash
# Secure .env file permissions
chmod 600 .env
chown root:root .env

# Secure log directories
mkdir -p logs screenshots downloads
chmod 755 logs screenshots downloads
```

## 🧪 **PRE-DEPLOYMENT TESTING**

### 10. **Environment Validation**
```bash
# Test environment variable loading
npm run test:env

# Validate all required variables are set
npm run validate:config

# Test database/service connections
npm run test:connections
```

### 11. **Integration Tests**
- [ ] Test vAuto login functionality
- [ ] Verify 2FA SMS reception
- [ ] Test email notifications
- [ ] Validate dashboard connectivity
- [ ] Check webhook endpoints

## 🚀 **DEPLOYMENT STEPS**

### 12. **Staging Deployment**
1. **Backup current configuration**
   ```bash
   cp .env .env.backup.$(date +%Y%m%d)
   ```

2. **Apply staging configuration**
   ```bash
   cp .env.staging .env
   # Fill in actual values for ${VARIABLE} placeholders
   ```

3. **Install dependencies**
   ```bash
   npm ci --production
   ```

4. **Build application**
   ```bash
   npm run build
   npm run dashboard:build
   ```

5. **Start services**
   ```bash
   # Use PM2 for process management
   pm2 start ecosystem.config.js
   pm2 save
   ```

### 13. **Post-Deployment Verification**
- [ ] Check application health: `curl https://your-staging-url/api/health`
- [ ] Monitor logs: `pm2 logs`
- [ ] Test core functionality
- [ ] Verify dashboard access
- [ ] Test automation workflow

## 📊 **MONITORING SETUP**

### 14. **Health Checks**
- [ ] Configure `/api/health` endpoint monitoring
- [ ] Set up log rotation with PM2
- [ ] Configure error alerting
- [ ] Monitor memory and CPU usage

### 15. **Backup Strategy**
- [ ] Schedule configuration backups
- [ ] Set up log archival
- [ ] Configure database backups (if applicable)

## 🐛 **TROUBLESHOOTING**

### Common Issues:
1. **Chrome crashes** → Add `--no-sandbox --disable-dev-shm-usage` flags
2. **Memory issues** → Increase Node.js memory: `--max-old-space-size=4096`
3. **Permission errors** → Check file ownership and permissions
4. **Port conflicts** → Verify ports 3000, 8080 are available

### Debug Commands:
```bash
# Check process status
pm2 status

# View logs
pm2 logs vee-otto

# Restart services
pm2 restart all

# Check port usage
netstat -tulpn | grep -E '3000|8080'
```

## ✅ **FINAL CHECKLIST**

Before going live:
- [ ] All sensitive credentials moved to environment secrets
- [ ] Staging URLs configured correctly
- [ ] Security settings hardened
- [ ] Integration tests passing
- [ ] Monitoring and alerting configured
- [ ] Backup strategy implemented
- [ ] Documentation updated

---

**⚠️ CRITICAL REMINDER:** Never commit the actual `.env` file with real credentials to version control. Use `.env.example` for documentation only.