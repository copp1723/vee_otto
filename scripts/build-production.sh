#!/bin/bash

# Production Build Script
# Builds only the core automation components

echo "🏗️ Building production components..."

# Clean previous build
echo "Cleaning dist directory..."
rm -rf dist

# Build core components
echo "Building core automation framework..."
npx tsc -p tsconfig.production.json

# Copy necessary config files
echo "Copying configuration files..."
mkdir -p dist/config
cp -r config/templates dist/config/ 2>/dev/null || true
cp -r macros dist/ 2>/dev/null || true

# Create production package.json
echo "Creating production package.json..."
node -e "
const pkg = require('./package.json');
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: 'dist/scripts/run-vauto.js',
  engines: pkg.engines,
  dependencies: {
    '@types/node': pkg.dependencies['@types/node'],
    'dotenv': pkg.dependencies['dotenv'],
    'fs-extra': pkg.dependencies['fs-extra'],
    'playwright': pkg.dependencies['playwright'],
    'winston': pkg.dependencies['winston'],
    'winston-daily-rotate-file': pkg.dependencies['winston-daily-rotate-file'],
    'p-retry': pkg.dependencies['p-retry'],
    'p-queue': pkg.dependencies['p-queue'],
    'fuzzball': pkg.dependencies['fuzzball'],
    'tesseract.js': pkg.dependencies['tesseract.js'],
    'node-cron': pkg.dependencies['node-cron'],
    'mailgun.js': pkg.dependencies['mailgun.js'],
    'form-data': pkg.dependencies['form-data'],
    'nodemailer': pkg.dependencies['nodemailer']
  },
  scripts: {
    'start': 'node dist/scripts/run-vauto.js',
    'vauto': 'node dist/scripts/run-vauto.js'
  }
};
require('fs').writeFileSync('dist/package.json', JSON.stringify(prodPkg, null, 2));
"

echo "✅ Production build complete!"
echo ""
echo "📦 Production files are in ./dist/"
echo "To deploy:"
echo "  1. Copy the 'dist' directory to your production server"
echo "  2. Run 'npm install' in the dist directory"
echo "  3. Configure environment variables"
echo "  4. Run 'npm start' to begin automation"