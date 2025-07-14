#!/bin/bash

echo "🔧 Applying Vee Otto Fixes and Improvements..."
echo "=============================================="

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository. Please run this from your vee_otto project root."
    exit 1
fi

echo "📋 Current git status:"
git status --short

echo ""
echo "📁 Files to be added/committed:"
echo "  New files:"
echo "    - SETUP_REPORT.md (comprehensive setup documentation)"
echo "    - CHANGES_SUMMARY.md (this changelog)"
echo "    - todo.md (project progress tracking)"
echo "    - update-webhook-local.js (local webhook management)"
echo "    - config/email-config.json (email configuration template)"
echo "    - config/mailgun-config.json (Mailgun configuration template)"
echo "    - config/vauto-config.json (vAuto configuration template)"
echo ""
echo "  Modified files:"
echo "    - scripts/dashboard-server.js (fixed static file paths)"

echo ""
read -p "🤔 Do you want to add these files to git? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Adding new files..."
    git add SETUP_REPORT.md
    git add CHANGES_SUMMARY.md
    git add todo.md
    git add update-webhook-local.js
    git add config/email-config.json
    git add config/mailgun-config.json
    git add config/vauto-config.json
    git add apply-fixes.sh
    
    echo "📝 Adding modified files..."
    git add scripts/dashboard-server.js
    
    echo "✅ Files added to staging area"
    
    echo ""
    echo "📋 Staged changes:"
    git status --short
    
    echo ""
    read -p "🚀 Do you want to commit these changes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "💾 Committing changes..."
        git commit -m "Setup fixes and infrastructure improvements

- Fix dashboard server static file paths (resolves 404 errors)
- Add SMS webhook infrastructure for local development
- Add configuration templates for email, Mailgun, vAuto
- Add comprehensive setup and troubleshooting documentation
- Add local webhook management scripts
- All changes are self-contained and portable

Fixes applied during setup session:
- Dashboard server path resolution
- SMS webhook configuration
- Build process verification
- Environment configuration templates"
        
        echo "✅ Changes committed successfully!"
        echo ""
        echo "🎯 Next steps:"
        echo "1. Push to GitHub: git push origin main"
        echo "2. Test the fixes: npm run dashboard:build && npm run dashboard:prod"
        echo "3. Verify SMS system: node verify-sms-system.js"
        echo "4. Run automation test: npm run vauto:test"
    else
        echo "⏸️  Changes staged but not committed. You can commit later with:"
        echo "   git commit -m 'Setup fixes and infrastructure improvements'"
    fi
else
    echo "⏸️  No changes made. Files are ready to be added manually."
fi

echo ""
echo "📖 For detailed information about all changes, see:"
echo "   - CHANGES_SUMMARY.md (complete changelog)"
echo "   - SETUP_REPORT.md (setup documentation)"

echo ""
echo "🎉 Setup package ready! All fixes are self-contained and portable."

