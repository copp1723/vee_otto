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
export PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/.cache/ms-playwright
mkdir -p $PLAYWRIGHT_BROWSERS_PATH

if [ -d $XDG_CACHE_HOME/ms-playwright ]; then
  echo "Restoring Playwright browsers from cache..."
  cp -R $XDG_CACHE_HOME/ms-playwright/* $PLAYWRIGHT_BROWSERS_PATH/
fi

# Ensure build directory exists before creating validation script
mkdir -p build

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
    echo "⚠️ Browser verification inconclusive, continuing..."
fi

# Cache browsers for future builds
echo "💾 Caching browsers for future builds..."
if [ -d $PLAYWRIGHT_BROWSERS_PATH ]; then
    mkdir -p $XDG_CACHE_HOME/ms-playwright
    cp -R $PLAYWRIGHT_BROWSERS_PATH/* $XDG_CACHE_HOME/ms-playwright/ || echo "⚠️ Could not cache browsers"
fi

# Create browser validation script
echo "🔧 Creating browser validation script..."
cat > build/validate-browser.js << 'EOF'
const { chromium } = require('playwright');

async function validateBrowser() {
    try {
        console.log('🔍 Validating browser installation...');
        
        // Set the browser path
        const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/render/project/.cache/ms-playwright';
        const executablePath = `${browserPath}/chromium-1181/chrome-linux/chrome`;
        
        console.log(`Browser executable path: ${executablePath}`);
        
        // Check if browser directory exists
        const fs = require('fs');
        const path = require('path');
        const browserDir = path.dirname(executablePath);
        
        if (fs.existsSync(browserDir)) {
            console.log(`Contents of browser directory: ${JSON.stringify(fs.readdirSync(browserDir), null, 2)}`);
        } else {
            console.log(`Browser directory not found: ${browserDir}`);
            return false;
        }
        
        // Try to launch browser
        const browser = await chromium.launch({
            headless: true,
            executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions'
            ]
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
if ! node build/validate-browser.js; then
    echo "⚠️ Browser validation failed, but continuing with build..."
    echo "This may be due to headless environment restrictions"
fi

# Build TypeScript backend first
echo "🔨 Building TypeScript backend..."
npm run build

# Build frontend dashboard
echo "🎨 Building frontend dashboard..."
npm run dashboard:build

# Verify builds were successful
echo "📦 Verifying builds..."
if [ -f "build/src/server.js" ]; then
    echo "✅ Backend built successfully"
else
    echo "❌ Backend build failed - build/src/server.js not found"
    exit 1
fi

if [ -d "dist/dashboard" ]; then
    echo "✅ Frontend built successfully"
    echo "Dashboard files:"
    ls -la dist/dashboard/ | head -10
else
    echo "❌ Frontend build failed - dist/dashboard not found"
    exit 1
fi

# Create necessary directories
echo "📁 Creating runtime directories..."
mkdir -p logs screenshots downloads

# Set proper permissions
chmod 755 logs screenshots downloads

# Create startup script with browser validation
echo "📝 Creating startup script..."
cat > build/startup.sh << 'EOF'
#!/bin/bash
set -e

export PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/.cache/ms-playwright

echo "🚀 Starting Vee Otto application..."

# Change to the build directory where this script is located
cd "$(dirname "$0")"

# Debug: Show current directory and file structure
echo "📍 Current directory: $(pwd)"
echo "📂 Contents of current directory:"
ls -la

echo "📂 Contents of parent directory:"
ls -la ..

echo "📂 Looking for dashboard at ../../dist/dashboard:"
ls -la ../../dist/dashboard/ 2>/dev/null || echo "❌ Dashboard directory not found"

# Validate browser installation at startup
echo "🔍 Validating browser installation..."
if ! node validate-browser.js; then
    echo "⚠️ Browser validation failed, attempting to reinstall..."
    # Navigate to project root to access node_modules
    cd ..
    export PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/.cache/ms-playwright
    node node_modules/playwright/cli.js install chromium || {
        echo "⚠️ Browser reinstallation failed, continuing anyway..."
        echo "The application will handle browser issues at runtime"
    }
    # Return to build directory
    cd build
fi

# Start the application
echo "🎯 Starting server..."
exec node src/server.js
EOF

chmod +x build/startup.sh

echo "✅ Build completed successfully!"
echo "📊 Build artifacts:"
echo "  - Backend: build/"
echo "  - Frontend: dist/dashboard/"
echo "  - Runtime dirs: logs/, screenshots/, downloads/"
echo "  - Browser validation: build/validate-browser.js"
echo "  - Startup script: build/startup.sh"