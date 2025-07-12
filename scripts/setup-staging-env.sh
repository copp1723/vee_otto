#!/bin/bash

# Vee Otto Staging Environment Setup Script
# This script helps configure environment variables securely for staging deployment

set -e

echo "🚀 Vee Otto Staging Environment Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to prompt for secure input
prompt_secure() {
    local prompt="$1"
    local var_name="$2"
    local current_value="${!var_name}"
    
    if [ -n "$current_value" ]; then
        echo -e "${GREEN}✓${NC} $var_name is already set"
        return 0
    fi
    
    echo -e "${YELLOW}Enter $prompt:${NC}"
    read -s value
    if [ -n "$value" ]; then
        export "$var_name"="$value"
        echo -e "${GREEN}✓${NC} $var_name set successfully"
    else
        echo -e "${RED}✗${NC} $var_name not set (empty value)"
        return 1
    fi
}

# Function to prompt for regular input
prompt_regular() {
    local prompt="$1"
    local var_name="$2"
    local default_value="$3"
    local current_value="${!var_name}"
    
    if [ -n "$current_value" ]; then
        echo -e "${GREEN}✓${NC} $var_name is already set: $current_value"
        return 0
    fi
    
    if [ -n "$default_value" ]; then
        echo -e "${YELLOW}Enter $prompt (default: $default_value):${NC}"
    else
        echo -e "${YELLOW}Enter $prompt:${NC}"
    fi
    
    read value
    if [ -z "$value" ] && [ -n "$default_value" ]; then
        value="$default_value"
    fi
    
    if [ -n "$value" ]; then
        export "$var_name"="$value"
        echo -e "${GREEN}✓${NC} $var_name set to: $value"
    else
        echo -e "${RED}✗${NC} $var_name not set"
        return 1
    fi
}

echo ""
echo -e "${BLUE}Setting up required environment variables...${NC}"
echo ""

# Platform credentials
echo "=== Platform Credentials ==="
prompt_regular "vAuto Username" "PLATFORM_USERNAME"
prompt_secure "vAuto Password" "PLATFORM_PASSWORD"

echo ""
echo "=== Security Configuration ==="
# Generate secure JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    export JWT_SECRET
    echo -e "${GREEN}✓${NC} JWT_SECRET generated automatically"
else
    echo -e "${GREEN}✓${NC} JWT_SECRET already set"
fi

prompt_secure "Admin Password" "ADMIN_PASS"

echo ""
echo "=== External Service Credentials ==="
prompt_secure "Mailgun API Key" "MAILGUN_API_KEY"
prompt_regular "Mailgun Domain" "MAILGUN_DOMAIN"

prompt_secure "Twilio Account SID" "TWILIO_ACCOUNT_SID" 
prompt_secure "Twilio Auth Token" "TWILIO_AUTH_TOKEN"

prompt_secure "OpenRouter API Key" "OPENROUTER_API_KEY"

echo ""
echo "=== Email Configuration ==="
prompt_regular "SMTP User Email" "SMTP_USER"
prompt_secure "SMTP Password/App Password" "SMTP_PASS"

echo ""
echo -e "${BLUE}Creating environment export script...${NC}"

# Create export script
cat > .env.local << EOF
#!/bin/bash
# Vee Otto Environment Variables - DO NOT COMMIT TO VERSION CONTROL
# Source this file: source .env.local

# Platform Credentials
export PLATFORM_USERNAME="$PLATFORM_USERNAME"
export PLATFORM_PASSWORD="$PLATFORM_PASSWORD"

# Security
export JWT_SECRET="$JWT_SECRET"
export ADMIN_PASS="$ADMIN_PASS"

# External Services
export MAILGUN_API_KEY="$MAILGUN_API_KEY"
export MAILGUN_DOMAIN="$MAILGUN_DOMAIN"
export TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID"
export TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN"
export OPENROUTER_API_KEY="$OPENROUTER_API_KEY"

# Email
export SMTP_USER="$SMTP_USER"
export SMTP_PASS="$SMTP_PASS"

echo "Environment variables loaded for Vee Otto staging deployment"
EOF

chmod 600 .env.local

echo ""
echo -e "${GREEN}✅ Environment setup complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Source the environment file: ${YELLOW}source .env.local${NC}"
echo "2. Validate configuration: ${YELLOW}node scripts/validate-staging-env.js${NC}"
echo "3. Start the application: ${YELLOW}npm start${NC}"
echo ""
echo -e "${RED}⚠️  IMPORTANT: .env.local contains sensitive data and is gitignored${NC}"
echo "   Share credentials securely with your team through encrypted channels"
echo ""