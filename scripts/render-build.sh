#!/bin/bash

# Render Build Script for Vee Otto
# This script prepares the application for deployment on Render

set -e

echo "🚀 Building Vee Otto for Render deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Debug: Check npm installation
echo "🔍 Debug: Checking npm packages..."
npm list playwright || echo "Failed to list playwright"

# Debug: Check node_modules structure
echo "🔍 Debug: Checking node_modules..."
ls -la node_modules/.bin/ | grep -i playwright || echo "No playwright in .bin"
ls -la node_modules/playwright/ || echo "No playwright directory"

# Debug: Try to find playwright executable
echo "🔍 Debug: Looking for playwright executable..."
which playwright || echo "playwright not in PATH"
find node_modules -name "playwright" -type f -executable 2>/dev/null || echo "No executable playwright found"

# Debug: Check npx availability
echo "🔍 Debug: Testing npx..."
npx --version || echo "npx not available"

# Try direct node execution of playwright
echo "🔍 Debug: Trying direct node execution..."
node node_modules/playwright/cli.js --version || echo "Direct execution failed"

# Install Playwright browsers for Render environment with enhanced caching
echo "🎭 Preparing Playwright browser installation..."
echo "Setting up Playwright cache directory..."
export PLAYWRIGHT_BROWSERS_PATH=/opt/render/.cache/ms-playwright
mkdir -p $PLAYWRIGHT_BROWSERS_PATH

# Ensure dist directory exists before creating validation script
mkdir -p dist

# Try alternative installation approach
echo "Installing Chromium with system dependencies..."
if [ -f "node_modules/playwright/cli.js" ]; then
    echo "Using direct node execution for playwright..."
    node node_modules/playwright/cli.js install chromium --with-deps || {
        echo "⚠️ Initial browser installation failed, retrying with force..."
        node node_modules/playwright/cli.js install chromium --force --with-deps
    }
else
    echo "❌ Playwright CLI not found at expected location"
    echo "Attempting npx fallback..."
    if ! npx playwright install chromium --with-deps; then
        echo "⚠️ Initial browser installation failed, retrying with force..."
        npx playwright install chromium --force --with-deps
    fi
fi

# Verify browser installation
echo "🔍 Verifying browser installation..."
if npx playwright install --dry-run chromium 2>&1 | grep -q "is already installed"; then
    echo "✅ Chromium browser verified successfully"
else
    echo "⚠️ Browser installation may be incomplete, attempting reinstall..."
    npx playwright install chromium --force --with-deps
fi

# Create browser validation script
echo "📝 Creating browser validation script..."
cat > dist/validate-browser.js << 'EOF'
const { chromium } = require('playwright');
const fs = require('fs');

async function validateBrowser() {
    try {
        console.log('🔍 Validating browser installation...');
        
        // Check if browser executable exists
        const executablePath = chromium.executablePath();
        console.log('Browser executable path:', executablePath);
        
        if (!fs.existsSync(executablePath)) {
            throw new Error(`Browser executable not found at: ${executablePath}`);
        }
        
        // Test browser launch
        const browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        console.log('✅ Browser launched successfully');
        await browser.close();
        console.log('✅ Browser validation completed');
        
        return true;
    } catch (error) {
        console.error('❌ Browser validation failed:', error.message);
        return false;
    }
}

if (require.main === module) {
    validateBrowser().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { validateBrowser };
EOF

# Run browser validation
echo "🧪 Running browser validation..."
node dist/validate-browser.js

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Build dashboard frontend
echo "🏗️ Building dashboard frontend..."
npm run dashboard:build

# Create necessary directories
echo "📁 Creating runtime directories..."
mkdir -p logs screenshots downloads

# Set proper permissions
chmod 755 logs screenshots downloads

# Copy static files for frontend deployment
echo "📋 Preparing static files..."
mkdir -p dist/frontend
cp -r frontend/public/* dist/frontend/ 2>/dev/null || true

# Create startup script with browser validation
echo "📝 Creating startup script..."
cat > dist/startup.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting Vee Otto application..."

# Validate browser installation at startup
echo "🔍 Validating browser installation..."
if ! node validate-browser.js; then
    echo "❌ Browser validation failed, attempting to reinstall..."
    npx playwright install chromium --with-deps || {
        echo "❌ Browser installation failed"
        exit 1
    }
fi

# Start the application
echo "🎯 Starting server..."
exec node server.js
EOF

chmod +x dist/startup.sh

echo "✅ Build completed successfully!"
echo "📊 Build artifacts:"
echo "  - Backend: dist/"
echo "  - Frontend: dist/frontend/"
echo "  - Runtime dirs: logs/, screenshots/, downloads/"
echo "  - Browser validation: dist/validate-browser.js"
echo "  - Startup script: dist/startup.sh"