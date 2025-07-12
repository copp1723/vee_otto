#!/bin/bash

echo "🚀 Starting Vee Otto Dashboard..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please update it with your settings."
    echo ""
fi

echo "Starting services..."
echo "================================"
echo "Backend server: http://localhost:3000"
echo "Dashboard UI:   http://localhost:8080"
echo "================================"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    pkill -f "ts-node src/server.ts"
    pkill -f "webpack serve"
    exit 0
}

# Set up trap for clean exit
trap cleanup INT TERM

# Start backend server
echo "🔧 Starting backend server..."
npm run server:dev &
SERVER_PID=$!

# Wait a bit for server to start
sleep 3

# Start dashboard frontend
echo "🎨 Starting dashboard UI..."
npm run dashboard:dev &
DASHBOARD_PID=$!

# Wait a bit for webpack to start
sleep 5

echo ""
echo "✅ Dashboard is starting up!"
echo ""
echo "📋 Default login credentials:"
echo "   Username: admin"
echo "   Password: Check your .env file (ADMIN_PASS)"
echo ""
echo "🌐 Open your browser to: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running
wait $SERVER_PID $DASHBOARD_PID
