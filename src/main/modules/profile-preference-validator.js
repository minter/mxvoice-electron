const MIN_BACKUP_INTERVAL = 15 * 60 * 1000;
const MAX_BACKUP_INTERVAL = 24 * 60 * 60 * 1000;
const MIN_BACKUP_COUNT = 1;
const MAX_BACKUP_COUNT = 100;
const MIN_BACKUP_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_BACKUP_AGE = 90 * 24 * 60 * 60 * 1000;

const DEFAULT_BACKUP_SETTINGS = Object.freeze({
  autoBackupEnabled: true,
  backupInterval: 30 * 60 * 1000,
  maxBackupCount: 25,
  maxBackupAge: 30 * 24 * 60 * 60 * 1000
});

const BACKUP_SETTING_KEYS = new Set(Object.keys(DEFAULT_BACKUP_SETTINGS));

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isIntegerInRange(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function isValidBackupAge(value) {
  return value === 0 || isIntegerInRange(value, MIN_BACKUP_AGE, MAX_BACKUP_AGE);
}

function getDefaultBackupSettings() {
  return { ...DEFAULT_BACKUP_SETTINGS };
}

function getSafeBackupSettings(settings) {
  const source = isPlainObject(settings) ? settings : {};
  return {
    autoBackupEnabled: typeof source.autoBackupEnabled === 'boolean'
      ? source.autoBackupEnabled
      : DEFAULT_BACKUP_SETTINGS.autoBackupEnabled,
    backupInterval: isIntegerInRange(source.backupInterval, MIN_BACKUP_INTERVAL, MAX_BACKUP_INTERVAL)
      ? source.backupInterval
      : DEFAULT_BACKUP_SETTINGS.backupInterval,
    maxBackupCount: isIntegerInRange(source.maxBackupCount, MIN_BACKUP_COUNT, MAX_BACKUP_COUNT)
      ? source.maxBackupCount
      : DEFAULT_BACKUP_SETTINGS.maxBackupCount,
    maxBackupAge: isValidBackupAge(source.maxBackupAge)
      ? source.maxBackupAge
      : DEFAULT_BACKUP_SETTINGS.maxBackupAge
  };
}

/**
 * Validate and complete the security-sensitive backup policy.
 * Missing fields use defaults for compatibility with older and partial profiles.
 */
function validateBackupSettings(settings, { allowMissing = true } = {}) {
  if (settings === undefined && allowMissing) {
    return { valid: true, value: getDefaultBackupSettings() };
  }
  if (!isPlainObject(settings)) {
    return {
      valid: false,
      error: 'backup_settings must be an object',
      value: getSafeBackupSettings(settings)
    };
  }

  const unknownKey = Object.keys(settings).find((key) => !BACKUP_SETTING_KEYS.has(key));
  if (unknownKey) {
    return {
      valid: false,
      error: `backup_settings contains unsupported field: ${unknownKey}`,
      value: getSafeBackupSettings(settings)
    };
  }

  if ('autoBackupEnabled' in settings && typeof settings.autoBackupEnabled !== 'boolean') {
    return {
      valid: false,
      error: 'autoBackupEnabled must be a boolean',
      value: getSafeBackupSettings(settings)
    };
  }

  const integerRules = [
    ['backupInterval', MIN_BACKUP_INTERVAL, MAX_BACKUP_INTERVAL],
    ['maxBackupCount', MIN_BACKUP_COUNT, MAX_BACKUP_COUNT]
  ];
  for (const [key, min, max] of integerRules) {
    if (key in settings && !isIntegerInRange(settings[key], min, max)) {
      return {
        valid: false,
        error: `${key} must be a safe integer between ${min} and ${max}`,
        value: getSafeBackupSettings(settings)
      };
    }
  }

  if ('maxBackupAge' in settings && !isValidBackupAge(settings.maxBackupAge)) {
    return {
      valid: false,
      error: `maxBackupAge must be 0 or a safe integer between ${MIN_BACKUP_AGE} and ${MAX_BACKUP_AGE}`,
      value: getSafeBackupSettings(settings)
    };
  }

  return {
    valid: true,
    value: { ...DEFAULT_BACKUP_SETTINGS, ...settings }
  };
}

/**
 * Validate a complete preference document while preserving unrelated fields.
 */
function validateProfilePreferences(preferences) {
  if (!isPlainObject(preferences)) {
    return { valid: false, error: 'Profile preferences must be an object', value: null };
  }

  const backupSettings = validateBackupSettings(preferences.backup_settings);
  return {
    valid: backupSettings.valid,
    error: backupSettings.error,
    value: {
      ...preferences,
      backup_settings: backupSettings.value
    }
  };
}

function validateBackupRetentionPolicy(maxCount, maxAge) {
  if (!isIntegerInRange(maxCount, MIN_BACKUP_COUNT, MAX_BACKUP_COUNT)) {
    return {
      valid: false,
      error: `maxBackupCount must be a safe integer between ${MIN_BACKUP_COUNT} and ${MAX_BACKUP_COUNT}`
    };
  }
  if (!isValidBackupAge(maxAge)) {
    return {
      valid: false,
      error: `maxBackupAge must be 0 or a safe integer between ${MIN_BACKUP_AGE} and ${MAX_BACKUP_AGE}`
    };
  }
  return { valid: true };
}

export {
  DEFAULT_BACKUP_SETTINGS,
  MIN_BACKUP_INTERVAL,
  MAX_BACKUP_INTERVAL,
  MIN_BACKUP_COUNT,
  MAX_BACKUP_COUNT,
  MIN_BACKUP_AGE,
  MAX_BACKUP_AGE,
  getDefaultBackupSettings,
  getSafeBackupSettings,
  validateBackupSettings,
  validateProfilePreferences,
  validateBackupRetentionPolicy
};
