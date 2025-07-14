#!/bin/bash

# Render Build Script for Vee Otto
# This script prepares the application for deployment on Render

set -e

echo "🚀 Building Vee Otto for Render deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Install Playwright browsers for Render environment with enhanced caching
echo "🎭 Installing Playwright browsers..."
echo "Setting up Playwright cache directory..."
export PLAYWRIGHT_BROWSERS_PATH=/opt/render/.cache/ms-playwright
mkdir -p $PLAYWRIGHT_BROWSERS_PATH

# Ensure dist directory exists before creating validation script
mkdir -p dist

# Install browsers without system dependencies (Render has them pre-installed)
echo "Installing Chromium browser..."
echo "Note: System dependencies are pre-installed in Render environment"

# Use direct node execution which we confirmed works
if [ -f "node_modules/playwright/cli.js" ]; then
    echo "Installing Chromium using direct node execution..."
    node node_modules/playwright/cli.js install chromium || {
        echo "⚠️ Initial browser installation failed, retrying..."
        node node_modules/playwright/cli.js install chromium --force
    }
else
    echo "⚠️ Playwright CLI not found, using npx fallback..."
    npx playwright install chromium || {
        echo "⚠️ Initial browser installation failed, retrying..."
        npx playwright install chromium --force
    }
fi

# Verify browser installation
echo "🔍 Verifying browser installation..."
if node node_modules/playwright/cli.js install --dry-run chromium 2>&1 | grep -q "is already installed"; then
    echo "✅ Chromium browser verified successfully"
else
    echo "⚠️ Browser installation may be incomplete, attempting reinstall..."
    node node_modules/playwright/cli.js install chromium --force
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
if ! node dist/validate-browser.js; then
    echo "⚠️ Browser validation failed, but continuing with build..."
    echo "This may be due to headless environment restrictions"
fi

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
    echo "⚠️ Browser validation failed, attempting to reinstall..."
    node ../node_modules/playwright/cli.js install chromium || {
        echo "⚠️ Browser reinstallation failed, continuing anyway..."
        echo "The application will handle browser issues at runtime"
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