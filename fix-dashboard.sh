#!/bin/bash

echo "🔧 Fixing Vee Otto Dashboard Setup..."
echo ""

# Kill any running processes
echo "Stopping any running services..."
pkill -f "webpack serve" 2>/dev/null
pkill -f "ts-node src/server.ts" 2>/dev/null
sleep 2

# Clean install dependencies
echo "📦 Reinstalling dependencies..."
rm -rf node_modules package-lock.json
npm install

echo ""
echo "🚀 Starting dashboard (frontend only for now)..."
echo ""

# Start only the frontend dashboard
npm run dashboard:dev
