# Vee Otto Complete Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Development Deployment](#development-deployment)
4. [Production Deployment](#production-deployment)
5. [Render Cloud Deployment](#render-cloud-deployment)
6. [Staging Environment Setup](#staging-environment-setup)
7. [Docker Deployment](#docker-deployment)
8. [Security Considerations](#security-considerations)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

## Overview

This guide covers deploying Vee Otto in various environments, from local development to production cloud infrastructure. The system consists of:

- **Automation Engine**: Node.js/TypeScript application with Playwright
- **Operations Dashboard**: React SPA with WebSocket support
- **Background Services**: Scheduler, webhook handler, notification service
- **External Dependencies**: UI Vision RPA, email services, vAuto API access

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ / Windows Server 2019+ / macOS 12+
- **Node.js**: 18.x or 20.x
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: 20GB free space for logs and screenshots
- **Network**: Stable internet connection for vAuto access

### Software Dependencies

```bash
# Required
- Node.js 18+ and npm 8+
- Git
- Chrome/Chromium browser
- PM2 (for process management)

# Optional
- Docker & Docker Compose
- Nginx (for reverse proxy)
- Redis (for session management)
- PostgreSQL (for audit logs)
```

## Development Deployment

### Local Setup
```bash
# Clone repository
git clone <repository-url>
cd vee_otto

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

### Environment Variables for Development
```bash
NODE_ENV=development
HEADLESS=false
LOG_LEVEL=debug
DASHBOARD_INTEGRATION=true
```

## Production Deployment

### Standard Production Setup
```bash
# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Configure nginx reverse proxy
sudo nginx -t && sudo systemctl reload nginx
```

### Production Environment Variables
```bash
NODE_ENV=production
HEADLESS=true
LOG_LEVEL=warn
DASHBOARD_INTEGRATION=true
```

## Render Cloud Deployment

### 🚀 Quick Deploy to Render

Deploy both the UI dashboard and backend API to Render for staging/production.

#### Deployment Architecture

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
└─────────────────────────────────────────────────┘
```

#### Step 1: Deploy from GitHub

**Option A: Blueprint Deployment (Recommended)**
1. Fork/Push your repository to GitHub
2. Go to Render Dashboard: [dashboard.render.com](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect Repository: Select your vee-otto repository
5. Deploy: Render will automatically create all services from `render.yaml`

**Option B: Manual Service Creation**
If blueprint deployment doesn't work, create services manually:

1. **Backend API Service**:
   - Service Type: Web Service
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Environment: Node.js

2. **Frontend Service**:
   - Service Type: Static Site
   - Build Command: `npm run build:frontend`
   - Publish Directory: `dist/dashboard`

#### Step 2: Configure Environment Variables

In Render dashboard, add these environment variables:

**Required Variables:**
```bash
NODE_ENV=production
VAUTO_USERNAME=your_actual_username
VAUTO_PASSWORD=your_actual_password
JWT_SECRET=your_secure_jwt_secret_32_chars_min
ADMIN_USER=admin
ADMIN_PASS=your_secure_admin_password
```

**Optional Variables:**
```bash
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=your_mailgun_domain
OPENROUTER_API_KEY=your_openrouter_key
```

## Staging Environment Setup

### 🚨 Security Checklist (CRITICAL)

- [ ] **Remove sensitive credentials from `.env`** - Move to environment secrets
- [ ] **Generate secure JWT_SECRET** (32+ characters)
- [ ] **Change ADMIN_PASS** from `password123` to secure password
- [ ] **Never commit `.env` with real credentials** to version control

### Staging Configuration
```bash
NODE_ENV=staging
HEADLESS=true
LOG_LEVEL=warn
DASHBOARD_INTEGRATION=true
SCREENSHOT_ON_FAILURE=true
READ_ONLY_MODE=true  # Safe mode for testing
MAX_VEHICLES_TO_PROCESS=1
```

### Testing Staging Deployment
```bash
# Run safe test
npm run vauto:test

# Check health
curl https://your-staging-url/health

# Monitor logs
pm2 logs vee-otto
```

## Docker Deployment

### Using Docker Compose
```bash
# Build and start
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Docker Environment Variables
Set these in your `docker-compose.yml` or `.env.docker`:
```bash
NODE_ENV=production
HEADLESS=true
DISPLAY=:99  # For virtual display
```

## Security Considerations

### Environment Security
- Use environment variables for all sensitive data
- Never commit `.env` files with real credentials
- Use strong passwords and JWT secrets
- Enable HTTPS in production
- Configure proper CORS settings

### Network Security
- Use reverse proxy (nginx) for SSL termination
- Implement rate limiting
- Configure firewall rules
- Use VPN for sensitive operations

## Monitoring & Maintenance

### Health Checks
```bash
# System health
curl /api/health/system

# Service status
pm2 status

# Resource usage
pm2 monit
```

### Log Management
```bash
# View application logs
tail -f logs/server.log

# PM2 logs
pm2 logs --lines 100

# Rotate logs
pm2 install pm2-logrotate
```

### Backup Strategy
- Database backups (if using)
- Configuration backups
- Log archival
- Screenshot storage cleanup

## Troubleshooting

### Common Issues

**Deployment Fails:**
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check environment variables

**Browser Automation Fails:**
- Ensure headless mode is enabled in production
- Check Chrome/Chromium installation
- Verify display configuration for Docker

**2FA Not Working:**
- Check webhook endpoints are accessible
- Verify Twilio/Mailgun configuration
- Test SMS/email delivery

**Dashboard Not Loading:**
- Check frontend build process
- Verify static file serving
- Check WebSocket connections

### Support Resources
- Check logs in `logs/` directory
- Review environment configuration
- Test individual components
- Monitor resource usage

### Emergency Procedures
```bash
# Stop all services
pm2 stop all

# Restart with safe mode
NODE_ENV=development npm start

# Reset to last known good state
git reset --hard HEAD~1
```

---

**Note**: This guide consolidates information from multiple deployment documents. Always test changes in staging before production deployment. 