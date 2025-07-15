#!/bin/bash

# Navigate to the project directory
cd "/Users/joshcopp/Desktop/MacMini Desktop/vee_otto"

echo "=== Removing temporary commit scripts ==="

# Remove the commit scripts from the scripts directory
rm -f scripts/commit_aesthetic_improvements.sh
rm -f scripts/commit_semantic_mapping.sh

echo "Removed commit_aesthetic_improvements.sh"
echo "Removed commit_semantic_mapping.sh"

# If they were tracked by git, remove them from git as well
if git ls-files --error-unmatch scripts/commit_aesthetic_improvements.sh > /dev/null 2>&1; then
    git rm scripts/commit_aesthetic_improvements.sh
    echo "Removed commit_aesthetic_improvements.sh from git tracking"
fi

if git ls-files --error-unmatch scripts/commit_semantic_mapping.sh > /dev/null 2>&1; then
    git rm scripts/commit_semantic_mapping.sh
    echo "Removed commit_semantic_mapping.sh from git tracking"
fi

echo "✅ Temporary commit scripts have been removed from the repository!"
