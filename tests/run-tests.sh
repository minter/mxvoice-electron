#!/bin/bash

# Test Runner Script for Mx. Voice Electron App
# This script demonstrates the correct workflow for testing Electron apps

echo "🎵 Mx. Voice Testing Workflow"
echo "=============================="
echo ""

# Check if app is running
echo "🔍 Checking if Mx. Voice app is running..."
if pgrep -f "Mx. Voice" > /dev/null; then
    echo "✅ Mx. Voice app is running"
else
    echo "❌ Mx. Voice app is not running"
    echo ""
    echo "🚀 Please start the app first:"
    echo "   yarn start"
    echo ""
    echo "Then run this script again in another terminal."
    exit 1
fi

echo ""
echo "🧪 Running tests against running app..."
echo ""

# Run the basic test with headed mode to see what's happening
echo "Running: yarn playwright test tests/e2e/holding-tank-basic.spec.js --headed"
yarn playwright test tests/e2e/holding-tank-basic.spec.js --headed

echo ""
echo "🎉 Test run completed!"
echo ""
echo "💡 Tips:"
echo "  - Use --headed flag to see browser interactions"
echo "  - Use --ui flag for interactive debugging"
echo "  - Keep your app running while developing tests"
echo ""
echo "📚 For more information, see:"
echo "  tests/ELECTRON_TESTING_GUIDE.md"
echo "  tests/README.md"
