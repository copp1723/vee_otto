#!/bin/bash

# Navigate to the project directory
cd "/Users/joshcopp/Desktop/MacMini Desktop/vee_otto"

echo "=== Building Dashboard with Updated UI Changes ==="

# Install dependencies if needed
echo "Checking dependencies..."
npm install --silent

# Clean previous build
echo "Cleaning previous build..."
rm -rf dist/dashboard

# Build the dashboard with webpack
echo "Building dashboard..."
npm run build:dashboard

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Dashboard build successful!"
    echo ""
    echo "To see the UI changes, run:"
    echo "npm run serve:dashboard"
    echo ""
    echo "Or run both build and serve together:"
    echo "npm run dashboard"
    echo ""
    echo "The dashboard will be available at: http://localhost:8080"
else
    echo "❌ Dashboard build failed!"
    exit 1
fi
