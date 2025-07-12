# Render Environment Variables Reference

## 🔑 **Environment Variables to Set in Render Dashboard**

Copy these **exact variable names and values** into your Render service environment settings.

### 🚨 **REQUIRED - Set These in Render Dashboard**

#### **vAuto Platform Credentials**
```
PLATFORM_USERNAME=your_vauto_username
PLATFORM_PASSWORD=your_vauto_password
```

#### **Security Settings**
```
JWT_SECRET=your_secure_32_character_secret_key_here
ADMIN_USER=admin
ADMIN_PASS=your_secure_admin_password
```

#### **Twilio SMS (2FA)**
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWO_FACTOR_PHONE=+1234567890
```

#### **Mailgun Email**
```
MAILGUN_API_KEY=your_actual_mailgun_api_key
MAILGUN_DOMAIN=your_actual_domain.com
```

#### **OpenRouter AI**
```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### **SMTP Email (Optional)**
```
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
```

#### **Dealership Info**
```
DEALERSHIP_NAME=Vee Otto Automation
```

### 🌐 **URLs - Set After First Deployment**

After your services are deployed, update these URLs in **both services**:

#### **Backend API Service** (vee-otto-api)
```
PUBLIC_URL=https://vee-otto-api.onrender.com
WEBHOOK_URL=https://vee-otto-api.onrender.com/webhooks/twilio/sms
FRONTEND_URL=https://vee-otto-frontend.onrender.com
REACT_APP_API_URL=https://vee-otto-api.onrender.com/api
REACT_APP_WS_URL=https://vee-otto-api.onrender.com
DASHBOARD_URL=https://vee-otto-frontend.onrender.com
```

#### **Worker Service** (vee-otto-scheduler)
Copy the same sensitive credentials from the API service.

## 📋 **Step-by-Step Environment Setup**

### **1. Deploy Services First**
- Deploy without setting URLs (they'll fail initially)
- Note the actual URLs Render assigns

### **2. Set Sensitive Variables**
For **both** `vee-otto-api` and `vee-otto-scheduler` services:
1. Go to service → **Environment** tab
2. Add each variable from "REQUIRED" section above
3. **Save** and **Deploy**

### **3. Update URLs**
After services are running:
1. Copy actual Render URLs (format: `https://service-name.onrender.com`)
2. Update URL variables in **vee-otto-api** service
3. **Redeploy** all services

### **4. Test Deployment**
- Frontend: Visit your frontend URL
- Backend Health: `https://your-api-url.onrender.com/api/health`
- Login: Use admin credentials you set

## 🔧 **Service-Specific Variables**

### **vee-otto-api** (Web Service)
✅ All variables above

### **vee-otto-scheduler** (Worker)
✅ All sensitive credentials (same as API)
❌ URL variables not needed

### **vee-otto-frontend** (Static Site)
❌ No environment variables needed (static site)

## 🎯 **Common Issues**

### **Problem: Services won't start**
**Solution**: Check all required variables are set with correct values

### **Problem: Frontend can't connect to API**
**Solution**: Verify `REACT_APP_API_URL` points to correct backend URL

### **Problem: 2FA not working**
**Solution**: Verify Twilio credentials and phone numbers match

### **Problem: Automation fails**
**Solution**: Check vAuto credentials and platform URLs

## 💡 **Pro Tips**

1. **Generate Secure JWT Secret**:
   ```bash
   # Use this command to generate:
   openssl rand -base64 32
   ```

2. **Copy Variables Efficiently**:
   - Copy from this file, not from .env
   - .env has comments that will break Render

3. **Test Incrementally**:
   - Set core variables first
   - Test basic functionality
   - Add optional variables later

4. **Use Environment Variable Groups**:
   - Create groups in Render for reuse across services
   - Easier to manage credentials

---

**✅ Use THIS file as your environment variable reference for Render deployment**