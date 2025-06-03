const path = require('path');
const fs = require('fs');

// Import platform-specific signing modules
const macNotarize = require('./notarize.js');

module.exports = async function afterSign(context) {
  const { electronPlatformName } = context;

  console.log(`Running afterSign hook for platform: ${electronPlatformName}`);

  if (electronPlatformName === 'darwin') {
    // macOS: Run notarization
    console.log('Running macOS notarization...');
    await macNotarize.default(context);
  } else {
    console.log(`No signing configured for platform: ${electronPlatformName} in afterSign hook`);
  }
};
