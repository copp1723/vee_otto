# Vee Otto Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Development Deployment](#development-deployment)
4. [Production Deployment](#production-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Cloud Deployment](#cloud-deployment)
7. [Security Considerations](#security-considerations)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

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

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/yourusername/vee-otto.git
cd vee-otto

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Setup configuration
cp .env.example .env
cp config/email-config.example.json config/email-config.json
cp config/mailgun-config.example.json config/mailgun-config.json
```

### 2. Configure Environment

Edit `.env` with your settings:

```bash
# vAuto Credentials
VAUTO_USERNAME=your_username
VAUTO_PASSWORD=your_password
VAUTO_DEALERSHIP_ID=your_dealership_id

# Development settings
NODE_ENV=development
HEADLESS=false
LOG_LEVEL=debug

# Dashboard
DASHBOARD_PORT=3000
FRONTEND_URL=http://localhost:8080
```

### 3. Start Services

```bash
# Terminal 1: Start automation engine
npm run server:dev

# Terminal 2: Start dashboard
npm run dashboard:dev

# Terminal 3: Start scheduled automation (optional)
npm run vauto
```

Access dashboard at `http://localhost:8080`

## Production Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt update && sudo apt install -y google-chrome-stable

# Install PM2 globally
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential
```

### 2. Application Setup

```bash
# Create application directory
sudo mkdir -p /opt/vee-otto
sudo chown $USER:$USER /opt/vee-otto

# Clone and setup
cd /opt/vee-otto
git clone https://github.com/yourusername/vee-otto.git .
npm ci --production

# Build TypeScript
npm run build

# Build dashboard
npm run dashboard:build
```

### 3. Production Configuration

Create production `.env`:

```bash
# Production settings
NODE_ENV=production
HEADLESS=true
LOG_LEVEL=info

# Security
JWT_SECRET=<generate-secure-secret>
ADMIN_USER=admin
ADMIN_PASS=<generate-secure-password>

# URLs
FRONTEND_URL=https://vee-otto.yourdomain.com
REACT_APP_API_URL=https://api.vee-otto.yourdomain.com
```

### 4. PM2 Process Management

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'vee-otto-server',
      script: './dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'vee-otto-scheduler',
      script: './dist/scripts/run-vauto.js',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '0 7,14 * * *',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

Start with PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Nginx Configuration

```nginx
server {
    listen 80;
    server_name vee-otto.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vee-otto.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/vee-otto.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vee-otto.yourdomain.com/privkey.pem;

    # Dashboard
    location / {
        root /opt/vee-otto/dist/frontend;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Docker Deployment

### 1. Dockerfile

```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy application
COPY . .

# Build
RUN npm run build
RUN npm run dashboard:build

# Create non-root user
RUN groupadd -r veeotto && useradd -r -g veeotto veeotto
RUN chown -R veeotto:veeotto /app

USER veeotto

EXPOSE 3000 8080

CMD ["npm", "start"]
```

### 2. Docker Compose

```yaml
version: '3.8'

services:
  vee-otto:
    build: .
    container_name: vee-otto
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - HEADLESS=true
    volumes:
      - ./logs:/app/logs
      - ./screenshots:/app/screenshots
      - ./config:/app/config
    env_file:
      - .env
    networks:
      - vee-otto-network

  redis:
    image: redis:7-alpine
    container_name: vee-otto-redis
    restart: unless-stopped
    volumes:
      - redis-data:/data
    networks:
      - vee-otto-network

  postgres:
    image: postgres:15-alpine
    container_name: vee-otto-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: veeotto
      POSTGRES_USER: veeotto
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - vee-otto-network

networks:
  vee-otto-network:
    driver: bridge

volumes:
  redis-data:
  postgres-data:
```

### 3. Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Cloud Deployment

### AWS EC2 Deployment

1. **Launch EC2 Instance**
   - AMI: Ubuntu Server 20.04 LTS
   - Instance Type: t3.medium (minimum)
   - Storage: 30GB EBS
   - Security Group: Allow ports 80, 443, 22

2. **Install Dependencies**
```bash
# Connect to instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Follow production deployment steps above
```

3. **Configure Auto Scaling**
```yaml
# cloudformation.yaml
Resources:
  AutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      MinSize: 1
      MaxSize: 3
      DesiredCapacity: 1
      HealthCheckType: ELB
      HealthCheckGracePeriod: 300
```

### Azure App Service

1. **Create App Service**
```bash
# Create resource group
az group create --name vee-otto-rg --location eastus

# Create app service plan
az appservice plan create --name vee-otto-plan --resource-group vee-otto-rg --sku B2 --is-linux

# Create web app
az webapp create --name vee-otto-app --resource-group vee-otto-rg --plan vee-otto-plan --runtime "NODE|18-lts"
```

2. **Deploy Application**
```bash
# Configure deployment
az webapp deployment source config --name vee-otto-app --resource-group vee-otto-rg --repo-url https://github.com/yourusername/vee-otto --branch main
```

### Google Cloud Run

1. **Build Container**
```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT-ID/vee-otto

# Deploy to Cloud Run
gcloud run deploy vee-otto --image gcr.io/PROJECT-ID/vee-otto --platform managed --region us-central1 --allow-unauthenticated
```

## Security Considerations

### 1. Environment Variables

- Never commit `.env` files
- Use secret management services (AWS Secrets Manager, Azure Key Vault)
- Rotate credentials regularly

### 2. Network Security

```bash
# Firewall rules (UFW)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2ban for SSH protection
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 3. SSL/TLS Configuration

```bash
# Let's Encrypt SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d vee-otto.yourdomain.com
```

### 4. Application Security

- Enable CORS properly
- Implement rate limiting
- Use helmet.js for security headers
- Sanitize all inputs
- Enable audit logging

## Monitoring & Maintenance

### 1. Health Checks

Create `/api/health` endpoint:

```typescript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: package.version
  });
});
```

### 2. Monitoring Setup

**PM2 Monitoring**:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**CloudWatch/Datadog Integration**:
```javascript
// Install agent
npm install @aws-sdk/client-cloudwatch

// Send custom metrics
await cloudWatch.putMetricData({
  Namespace: 'VeeOtto',
  MetricData: [{
    MetricName: 'ProcessedVehicles',
    Value: processedCount,
    Unit: 'Count'
  }]
});
```

### 3. Backup Strategy

```bash
# Backup script (backup.sh)
#!/bin/bash
BACKUP_DIR="/backup/vee-otto"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup config and data
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/vee-otto/config
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /opt/vee-otto/logs

# Backup database if using
pg_dump veeotto > $BACKUP_DIR/db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /opt/vee-otto/scripts/backup.sh
```

### 4. Updates & Maintenance

```bash
# Update script (update.sh)
#!/bin/bash
cd /opt/vee-otto

# Backup current version
cp -r . ../vee-otto-backup-$(date +%Y%m%d)

# Pull latest
git pull origin main

# Install dependencies
npm ci

# Build
npm run build
npm run dashboard:build

# Restart services
pm2 restart all
```

## Troubleshooting

### Common Issues

1. **Chrome/Chromium crashes**
   ```bash
   # Add Chrome flags
   CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage"
   ```

2. **Memory issues**
   ```bash
   # Increase Node memory
   NODE_OPTIONS="--max-old-space-size=4096"
   ```

3. **Permission errors**
   ```bash
   # Fix permissions
   sudo chown -R veeotto:veeotto /opt/vee-otto
   ```

4. **Port conflicts**
   ```bash
   # Check ports
   sudo netstat -tulpn | grep -E '3000|8080'
   ```

### Debug Mode

Enable debug logging:
```bash
DEBUG=vee-otto:* LOG_LEVEL=debug npm start
```

### Performance Tuning

1. **Node.js optimization**
   ```bash
   NODE_ENV=production
   NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
   ```

2. **PM2 cluster mode**
   ```javascript
   instances: 'max',
   exec_mode: 'cluster'
   ```

3. **Redis caching**
   ```javascript
   const redis = require('redis');
   const client = redis.createClient();
   
   // Cache frequently accessed data
   await client.setex('metrics', 300, JSON.stringify(metrics));
   ```

## Support

For deployment issues:
- Check logs: `pm2 logs`
- Review documentation: [docs.vee-otto.ai](https://docs.vee-otto.ai)
- Open issue: [GitHub Issues](https://github.com/yourusername/vee-otto/issues)
- Contact support: support@vee-otto.ai