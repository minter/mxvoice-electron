import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  default: { app: { getPath: vi.fn(() => '/tmp/mxvoice-test') } }
}));
vi.mock('electron-store', () => ({
  default: class { get() { return undefined; } }
}));

let isTestDatabaseFallbackAllowed;
beforeAll(async () => {
  ({ isTestDatabaseFallbackAllowed } = await import('../../../src/main/modules/database-setup.js'));
});

describe('database fallback policy', () => {
  it('disallows ephemeral fallback in production', () => {
    expect(isTestDatabaseFallbackAllowed({ NODE_ENV: 'production' })).toBe(false);
  });

  it.each([
    { APP_TEST_MODE: '1' },
    { E2E_USER_DATA_DIR: '/tmp/e2e' },
    { APP_TEST_USER_DATA_DIR: '/tmp/app-test' }
  ])('allows fallback only for an explicit test environment: %o', env => {
    expect(isTestDatabaseFallbackAllowed(env)).toBe(true);
  });
});
