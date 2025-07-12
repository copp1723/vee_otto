#!/bin/bash

# Vee Otto Codebase Cleanup Script
# This script removes unnecessary files to create a lean production codebase
# Run with: bash scripts/cleanup-codebase.sh

echo "🧹 Starting Vee Otto Codebase Cleanup..."
echo "This will remove development artifacts, test files, and duplicate code."
echo ""

# Safety check
read -p "Are you sure you want to proceed? This will permanently delete files. (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Cleanup cancelled."
    exit 1
fi

# Create a cleanup log
CLEANUP_LOG="cleanup-$(date +%Y%m%d-%H%M%S).log"
echo "Cleanup started at $(date)" > $CLEANUP_LOG

# Function to safely remove files/directories
safe_remove() {
    local path=$1
    if [ -e "$path" ]; then
        echo "Removing: $path"
        echo "Removed: $path" >> $CLEANUP_LOG
        rm -rf "$path"
    else
        echo "Skipping (not found): $path"
    fi
}

echo ""
echo "1️⃣ Removing backup directories..."
safe_remove "./backups"

echo ""
echo "2️⃣ Removing old test files..."
safe_remove "./tests/phase1-integration-test.ts"
safe_remove "./tests/phase1-simple-test.ts"
safe_remove "./tests/phase2-comprehensive-test.ts"
safe_remove "./tests/run-validation.ts"
safe_remove "./tests/run-validation-enhanced.ts"
safe_remove "./tests/test-validation.ts"
safe_remove "./tests/test-validation-enhanced.ts"
safe_remove "./tests/vision-enhanced-integration-test.ts"
safe_remove "./tests/vauto-vision-test-suite.ts"
safe_remove "./tests/test-hybrid-reliability.enhanced.ts"

echo ""
echo "3️⃣ Removing test mockup files..."
safe_remove "./tests/serve-vauto-mockup.js"
safe_remove "./tests/start-vauto-mockup.js"

echo ""
echo "4️⃣ Removing deployment artifacts..."
safe_remove "./deployments/simple-webhook"
safe_remove "./deployments/webhook-handler"

echo ""
echo "5️⃣ Removing duplicate/enhanced versions..."
safe_remove "./platforms/vauto/VAutoAgent.enhanced.ts"

echo ""
echo "6️⃣ Cleaning up reports and screenshots..."
safe_remove "./reports"
safe_remove "./tests/screenshots"

echo ""
echo "7️⃣ Removing development documentation..."
safe_remove "./docs/REORGANIZATION_PLAN.md"
safe_remove "./docs/HYBRID_IMPROVEMENTS.md"
safe_remove "./REORGANIZATION_SUMMARY.md"
safe_remove "./BACKEND_INTEGRATION_COMPLETE.md"
safe_remove "./git-commands-simulation.md"
safe_remove "./validation-report-simulation.md"

echo ""
echo "8️⃣ Creating clean directories..."
mkdir -p ./reports
mkdir -p ./logs
mkdir -p ./tests/screenshots

echo ""
echo "9️⃣ Optional: Remove frontend/dashboard (requires separate confirmation)..."
read -p "Do you want to remove the frontend/dashboard components? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "Removing frontend components..."
    safe_remove "./frontend"
    safe_remove "./src/DashboardIntegration.ts"
    safe_remove "./src/server.ts"
    safe_remove "./scripts/dashboard-server.js"
    safe_remove "./webpack.config.js"
    safe_remove "./fix-dashboard.sh"
    safe_remove "./start-dashboard.sh"
    safe_remove "./platforms/vauto/VAutoAgentWithDashboard.ts"
    safe_remove "./docs/DASHBOARD_README.md"
    safe_remove "./docs/DASHBOARD_INTEGRATION.md"
    
    echo "Note: You'll need to manually clean package.json to remove frontend dependencies"
else
    echo "Frontend components retained."
fi

echo ""
echo "✅ Cleanup completed!"
echo "📄 Cleanup log saved to: $CLEANUP_LOG"
echo ""
echo "Next steps:"
echo "1. Review the cleanup log"
echo "2. Run 'npm install' to ensure dependencies are correct"
echo "3. Run 'npm run build' to verify the build still works"
echo "4. Commit the cleaned codebase"

# Final statistics
echo ""
echo "📊 Cleanup Statistics:"
echo "Lines removed from log:"
wc -l $CLEANUP_LOG