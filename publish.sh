#!/bin/bash

# LocalDB JS - NPM Deployment Script
# یہ script automatically deployment process handle کرے گا

set -e  # Exit on any error

echo "🚀 LocalDB JS - NPM Deployment Process"
echo "========================================="
echo ""

# Step 1: Clean previous builds
echo "📦 Step 1: Cleaning previous builds..."
rm -f *.tgz
echo "✅ Cleaned"
echo ""

# Step 2: Run tests
echo "🧪 Step 2: Running tests..."
npm test
echo "✅ All tests passed"
echo ""

# Step 3: Check if logged in to npm
echo "👤 Step 3: Checking NPM login status..."
if npm whoami > /dev/null 2>&1; then
    echo "✅ Logged in as: $(npm whoami)"
else
    echo "❌ Not logged in to NPM"
    echo "Please run: npm login"
    exit 1
fi
echo ""

# Step 4: Verify package contents
echo "📋 Step 4: Verifying package contents..."
npm pack --dry-run
echo ""

# Step 5: Ask for confirmation
read -p "🤔 Ready to publish to NPM? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi
echo ""

# Step 6: Publish
echo "🚀 Step 6: Publishing to NPM..."
npm publish
echo ""

# Step 7: Verify publication
echo "✅ Step 7: Verifying publication..."
sleep 3
npm view dimond-db version
echo ""

echo "🎉 SUCCESS! Package published to NPM"
echo "📦 Install with: npm install dimond-db"
echo "🔗 View at: https://npmjs.com/package/dimond-db"
