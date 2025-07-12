#!/bin/bash

# Script to connect frontend to backend

echo "🔌 Connecting Frontend to Backend..."

# 1. Update Dashboard to use real API service
if [ -f "frontend/pages/Dashboard/index.tsx" ]; then
    echo "Updating Dashboard to use real API service..."
    sed -i '' "s/import { mockApiService }/import { apiService }/" frontend/pages/Dashboard/index.tsx
    sed -i '' "s/mockApiService/apiService/g" frontend/pages/Dashboard/index.tsx
fi

# 2. Create environment file if not exists
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Backend Configuration
PORT=3000
JWT_SECRET=your-secret-key-here

# Frontend Configuration  
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=http://localhost:3000

# Dashboard Integration
DASHBOARD_INTEGRATION=true

# vAuto Configuration
VAUTO_USERNAME=your_username
VAUTO_PASSWORD=your_password
HEADLESS=true
EOF
fi

echo "✅ Frontend-Backend connection configured!"
echo ""
echo "To run the connected system:"
echo "1. Terminal 1: npm run start:backend"
echo "2. Terminal 2: npm run start:frontend" 
echo "3. Terminal 3: npm run vauto (to run automation with dashboard updates)"