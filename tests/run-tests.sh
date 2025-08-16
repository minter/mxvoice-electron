#!/bin/bash

echo "🚀 Mx. Voice Electron App Testing"
echo "=================================="

# Check if Playwright is installed
if ! command -v playwright &> /dev/null; then
    echo "❌ Playwright not found. Installing..."
    yarn test:install
fi

echo "✅ Playwright is ready"
echo ""
echo "🧪 Running Electron app tests..."
echo "   - Tests will launch the app automatically"
echo "   - No need to run 'yarn start' separately"
echo ""

# Run the smoke tests
yarn test:smoke

echo ""
echo "🎉 Tests completed!"
echo "📊 View detailed report with: yarn test:report"
