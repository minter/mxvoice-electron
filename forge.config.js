const path = require('path')
const fs = require('fs')
const packageJson = require('./package.json')

const { version } = packageJson
const iconDir = path.resolve(__dirname, 'src', 'assets', 'icons')

const config = {
  packagerConfig: {
    icon: "src/assets/icons/mxvoice",
    osxSign: {
      hardenedRuntime: true,
      platform: "darwin",
      'gatekeeper-assess': false,
      entitlements: "static/entitlements.plist",
      'entitlements-inherit': "static/entitlements.plist",
      'signature-flags': "library"
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD
    }
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        setupIcon: "src/assets/icons/mxvoice.ico"
      }
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: [
        'darwin'
      ],
      config: {
        background: "src/assets/images/dmg-background-image.png",
        icon: "src/assets/icons/dmg-image.icns",
        additionalDMGOptions: {

        }
      }
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: [
        "darwin"
      ]
    }
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "minter",
          name: "mxvoice-electron"
        },
        draft: true,
        prerelease: false
      }
    }
  ]
}

module.exports = config
