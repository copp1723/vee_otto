#!/bin/bash

# Run all modules in sequence

echo "🚀 Running VAuto Automation Modules"
echo "==================================="

# Module 1: Login and 2FA
echo ""
echo "📋 MODULE 1: Login and 2FA"
echo "--------------------------"
npx ts-node scripts/modules/01-login-and-2fa.ts
if [ $? -ne 0 ]; then
    echo "❌ Module 1 failed!"
    exit 1
fi

# Module 2: Navigate to Inventory
echo ""
echo "📋 MODULE 2: Navigate to Inventory"
echo "----------------------------------"
npx ts-node scripts/modules/02-navigate-to-inventory.ts
if [ $? -ne 0 ]; then
    echo "❌ Module 2 failed!"
    exit 1
fi

# Module 3: Click Vehicle
echo ""
echo "📋 MODULE 3: Click Vehicle"
echo "--------------------------"
npx ts-node scripts/modules/03-click-vehicle.ts
if [ $? -ne 0 ]; then
    echo "❌ Module 3 failed!"
    exit 1
fi

# Module 4: Click Factory Equipment
echo ""
echo "📋 MODULE 4: Click Factory Equipment"
echo "------------------------------------"
npx ts-node scripts/modules/04-click-factory-equipment.ts
if [ $? -ne 0 ]; then
    echo "❌ Module 4 failed!"
    exit 1
fi

echo ""
echo "✅ All modules completed successfully!" 