import path from 'path';
import fs from 'fs';

// Import platform-specific signing modules
import macNotarize from './notarize.js';

export default async function afterSign(context) {
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
