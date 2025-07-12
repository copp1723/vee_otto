# Render Deployment Guide for Vee Otto

## 🚀 **Quick Deploy to Render**

This guide will help you deploy both the UI dashboard and backend API to Render for staging.

### 📋 **Prerequisites**

1. **GitHub Repository**: Push your code to GitHub
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **Environment Variables**: Have your credentials ready

### 🏗️ **Deployment Architecture**

Your Vee Otto application will deploy as:

```
┌─────────────────────────────────────────────────┐
│                    Render                       │
├─────────────────────────────────────────────────┤
│  🌐 Frontend (Static Site)                     │
│     - React Dashboard UI                        │
│     - URL: https://vee-otto-frontend.onrender   │
├─────────────────────────────────────────────────┤
│  🔧 Backend API (Web Service)                  │
│     - Express server + WebSocket               │
│     - Automation engine                        │
│     - URL: https://vee-otto-api.onrender.com   │
├─────────────────────────────────────────────────┤
│  ⚡ Worker (Background Service)                │
│     - Scheduled vAuto automation               │
│     - Runs independently                       │
├─────────────────────────────────────────────────┤
│  💾 Redis (Optional)                          │
│     - Session storage                          │
│     - Cache layer                             │
└─────────────────────────────────────────────────┘
```

## 🚀 **Step 1: Deploy from GitHub**

### Option A: Blueprint Deployment (Recommended)
1. **Fork/Push** your repository to GitHub
2. **Go to Render Dashboard**: [dashboard.render.com](https://dashboard.render.com)
3. **Click "New"** → **"Blueprint"**
4. **Connect Repository**: Select your vee-otto repository
5. **Deploy**: Render will automatically create all services from [`render.yaml`](render.yaml)

### Option B: Manual Service Creation
If blueprint deployment doesn't work, create services manually:

#### Backend API Service
1. **New Web Service**
2. **Connect Repository**: Your GitHub repo
3. **Configuration**:
   ```
   Name: vee-otto-api
   Environment: Node
   Build Command: npm run render:build
   Start Command: npm run render:start
   Plan: Starter ($7/month)
   ```

#### Frontend Static Site
1. **New Static Site**
2. **Connect Repository**: Same GitHub repo
3. **Configuration**:
   ```
   Name: vee-otto-frontend  
   Build Command: npm run dashboard:build
   Publish Directory: dist/frontend
   ```

#### Background Worker
1. **New Background Worker**
2. **Connect Repository**: Same GitHub repo
3. **Configuration**:
   ```
   Name: vee-otto-scheduler
   Build Command: npm run build
   Start Command: node dist/scripts/run-vauto.js
   ```

## 🔑 **Step 2: Configure Environment Variables**

### Required Variables (Set in Render Dashboard)

Go to each service → **Environment** tab and add:

#### 🔒 **Sensitive Credentials**
```bash
# vAuto Platform
PLATFORM_USERNAME=your_vauto_username
PLATFORM_PASSWORD=your_vauto_password

# Security
JWT_SECRET=your_32_character_secret_key
ADMIN_PASS=your_secure_admin_password

# Twilio SMS
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1...
TWO_FACTOR_PHONE=+1...

# Mailgun Email
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=your_domain.com

# OpenRouter AI (Optional)
OPENROUTER_API_KEY=sk-or-v1-...

# SMTP Email (Optional)
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Dealership
DEALERSHIP_NAME=Your Dealership Name
```

#### ⚙️ **Service URLs** (Auto-configured by Render)
These will be automatically set once services are deployed:
- `PUBLIC_URL`
- `FRONTEND_URL` 
- `REACT_APP_API_URL`
- `REACT_APP_WS_URL`

## 🎯 **Step 3: Deploy and Test**

### Monitor Deployment
1. **Watch Build Logs**: Check each service for build success
2. **Check Health**: Backend should show "Live" status
3. **Test Frontend**: Visit your static site URL

### Test Your Application
1. **Access Dashboard**: `https://vee-otto-frontend.onrender.com`
2. **Login**: Use admin credentials you set
3. **Check API**: `https://vee-otto-api.onrender.com/api/health`
4. **Test Automation**: Manually trigger or wait for schedule

## 🔧 **Step 4: Configure Custom Domains (Optional)**

### Add Custom Domain
1. **Purchase Domain**: Get a domain (e.g., `veeotto.app`)
2. **Frontend Domain**: `app.veeotto.app` → Static Site
3. **API Domain**: `api.veeotto.app` → Web Service
4. **Update Environment Variables**:
   ```bash
   FRONTEND_URL=https://app.veeotto.app
   REACT_APP_API_URL=https://api.veeotto.app
   PUBLIC_URL=https://api.veeotto.app
   ```

## 📊 **Step 5: Monitor and Maintain**

### Health Monitoring
- **Logs**: Check service logs for errors
- **Metrics**: Monitor CPU/memory usage
- **Alerts**: Set up alerts for downtime

### Scaling
- **Upgrade Plans**: If needed, upgrade to Standard ($25/month)
- **Multiple Instances**: Scale horizontally if traffic increases

## 🐛 **Troubleshooting**

### Common Issues

#### 1. **Build Failures**
```bash
# Check build logs for:
- Missing dependencies
- TypeScript compilation errors
- Playwright installation issues
```

#### 2. **Frontend Not Loading**
```bash
# Check:
- REACT_APP_API_URL points to backend service
- CORS configuration in backend
- Static files published correctly
```

#### 3. **Backend API Errors**
```bash
# Check:
- Environment variables set correctly
- Database connections (if using)
- Playwright browser installation
```

#### 4. **Automation Not Running**
```bash
# Check worker service:
- Environment variables copied
- Twilio/Mailgun credentials
- vAuto login credentials
```

### Debug Commands
```bash
# Test environment variables
curl https://your-api.onrender.com/api/health

# Check service status
# View in Render dashboard → Service → Logs
```

## 💰 **Cost Estimate**

### Render Pricing (Monthly)
- **Frontend** (Static Site): Free
- **Backend** (Web Service): $7/month (Starter)
- **Worker** (Background): $7/month (Starter)
- **Redis** (Optional): $7/month (Starter)

**Total**: ~$14-21/month for full staging deployment

### Free Tier Limitations
- Services spin down after 15 minutes of inactivity
- 750 hours/month limit across all services
- Slower cold starts

## 🔗 **Next Steps**

After successful deployment:

1. **Test All Features**: Dashboard, automation, notifications
2. **Set Up Monitoring**: Health checks, error alerts
3. **Configure Domains**: Custom domains for professional URLs
4. **Backup Strategy**: Export configurations and data
5. **Production Planning**: Plan production deployment strategy

## 📞 **Support**

- **Render Docs**: [render.com/docs](https://render.com/docs)
- **Render Support**: Available in dashboard
- **Vee Otto Issues**: Check logs and error messages

---

**🎉 Your Vee Otto application should now be live on Render with both UI and automation running!**

Access your dashboard at: `https://vee-otto-frontend.onrender.com`