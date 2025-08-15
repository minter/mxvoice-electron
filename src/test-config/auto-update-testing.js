/**
 * Auto-Update Testing Configuration
 * 
 * This file contains test configurations for validating the auto-update
 * functionality for both 3.x (custom server) and 4.x (GitHub provider) users.
 */

export const TEST_CONFIGS = {
  // Test 3.x behavior (custom server)
  V3_1_5: {
    description: "Test 3.1.5 behavior with custom server",
    version: "3.1.5",
    expectedProvider: "custom",
    expectedServer: "https://download.mxvoice.app",
    testUrl: "https://download.mxvoice.app/update/darwin/x64/3.1.5",
    notes: "Should use custom download server"
  },

  // Test 4.x behavior (GitHub provider)
  V4_0_0: {
    description: "Test 4.0.0 behavior with GitHub provider",
    version: "4.0.0",
    expectedProvider: "github",
    expectedOwner: "minter",
    expectedRepo: "mxvoice-electron",
    notes: "Should use GitHub provider for multi-architecture support"
  },

  // Test transition scenario
  TRANSITION: {
    description: "Test transition from 3.x to 4.x",
    fromVersion: "3.1.5",
    toVersion: "4.0.0",
    notes: "Should migrate from custom server to GitHub provider"
  }
};

/**
 * Test scenarios to validate
 */
export const TEST_SCENARIOS = [
  {
    name: "3.x Custom Server Test",
    description: "Verify 3.1.5 users still use custom server",
    steps: [
      "Set app version to 3.1.5",
      "Start app and check auto-updater logs",
      "Verify 'custom' provider is used",
      "Verify custom server URL is constructed correctly",
      "Check that update check hits download.mxvoice.app"
    ]
  },
  {
    name: "4.x GitHub Provider Test",
    description: "Verify 4.0.0+ users use GitHub provider",
    steps: [
      "Set app version to 4.0.0",
      "Start app and check auto-updater logs",
      "Verify 'github' provider is used",
      "Verify GitHub owner/repo are set correctly",
      "Check that update check hits GitHub API"
    ]
  },
  {
    name: "Multi-Architecture Test",
    description: "Verify GitHub provider handles both x86 and arm64",
    steps: [
      "Test on x86_64 Mac",
      "Test on arm64 Mac",
      "Verify correct architecture detection",
      "Verify appropriate asset selection"
    ]
  },
  {
    name: "Release Notes Display Test",
    description: "Verify release notes are displayed correctly",
    steps: [
      "Simulate update-available event",
      "Check IPC message to renderer",
      "Verify release notes formatting",
      "Test markdown rendering"
    ]
  },
  {
    name: "Pre-release Update Logic Test",
    description: "Verify pre-release update logic works correctly",
    steps: [
      "Test with user preference enabled (should allow pre-releases)",
      "Test with user preference disabled but running pre-release (should allow pre-releases)",
      "Test with user preference disabled and running stable (should not allow pre-releases)",
      "Verify logs show correct logic breakdown"
    ]
  }
];

/**
 * Environment variables for testing
 */
export const TEST_ENV_VARS = {
  // Test 3.x behavior
  TEST_V3_1_5: "TEST_V3_1_5=true",
  
  // Test 4.x behavior  
  TEST_V4_0_0: "TEST_V4_0_0=true",
  
  // Test both scenarios
  TEST_BOTH: "TEST_V3_1_5=true TEST_V4_0_0=true"
};

/**
 * Expected log messages for validation
 */
export const EXPECTED_LOGS = {
  V3_1_5: [
    "Using custom server for version 3.1.5",
    "provider: custom",
    "server: download.mxvoice.app"
  ],
  V4_0_0: [
    "Using GitHub provider for version 4.0.0", 
    "provider: github"
  ],
  PRERELEASE_LOGIC: [
    "Prerelease updates enabled",
    "prereleaseEnabled: true",
    "userPreference: false",
    "isCurrentlyPrerelease: true",
    "currentVersion: 4.0.0-pre.4"
  ]
};
