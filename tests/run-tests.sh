#!/bin/bash

echo "🚀 Mx. Voice Electron App Testing"
echo "=================================="

# Check if Playwright is installed
if ! command -v playwright &> /dev/null; then
    echo "❌ Playwright not found. Installing..."
    npm run test:install
fi

echo "✅ Playwright is ready"
echo ""
echo "🧪 Running Electron app tests..."
echo "   - Tests will launch the app automatically"
echo "   - No need to run 'npm start' separately"
echo ""

# Run the smoke tests
npm run test:smoke

echo ""
echo "🎉 Tests completed!"
echo "📊 View detailed report with: npm run test:report"
