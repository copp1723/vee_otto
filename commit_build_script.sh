#!/bin/bash

# Navigate to the project directory
cd "/Users/joshcopp/Desktop/MacMini Desktop/vee_otto"

echo "=== Committing Dashboard Build Script ==="

# Check git status first
echo "Current git status:"
git status --porcelain

# Add the build script
echo "Adding build_dashboard.sh..."
git add build_dashboard.sh

# Check what's staged
echo "Staged changes:"
git status --staged

# Commit with descriptive message
echo "Committing build script..."
git commit -m "🔧 Add dashboard build script for UI development

- Add build_dashboard.sh for easy dashboard compilation
- Includes dependency check and clean build process  
- Provides clear instructions for serving dashboard
- Helpful for applying CSS/UI changes that require webpack compilation

Usage:
  chmod +x build_dashboard.sh
  ./build_dashboard.sh

Or use npm scripts:
  npm run build:dashboard
  npm run serve:dashboard
  npm run dashboard (build + serve)"

# Push to remote
echo "Pushing to remote repository..."
git push origin

echo "✅ Successfully committed and pushed dashboard build script!"
