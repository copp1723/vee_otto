#!/bin/bash

# Render Build Script for Vee Otto
# This script prepares the application for deployment on Render

set -e

echo "🚀 Building Vee Otto for Render deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Install Playwright browsers for Render environment
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium --with-deps

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

echo "✅ Build completed successfully!"
echo "📊 Build artifacts:"
echo "  - Backend: dist/"
echo "  - Frontend: dist/frontend/"
echo "  - Runtime dirs: logs/, screenshots/, downloads/"