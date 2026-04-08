type LoginAttemptRecord = {
  attempts: number[];
  blockedUntil: number;
};

declare global {
  var __labAltaLoginRateLimitStore: Map<string, LoginAttemptRecord> | undefined;
}

const rateLimitStore =
  globalThis.__labAltaLoginRateLimitStore ??
  new Map<string, LoginAttemptRecord>();

if (!globalThis.__labAltaLoginRateLimitStore) {
  globalThis.__labAltaLoginRateLimitStore = rateLimitStore;
}

const WINDOW_MS = Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const LOCKOUT_MS = Number(process.env.AUTH_LOGIN_RATE_LIMIT_LOCKOUT_MS ?? 15 * 60 * 1000);
const MAX_FAILURES = Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX_FAILURES ?? 5);

const pruneRecord = (record: LoginAttemptRecord, now: number) => {
  record.attempts = record.attempts.filter((timestamp) => now - timestamp <= WINDOW_MS);

  if (record.blockedUntil <= now) {
    record.blockedUntil = 0;
  }

  return record;
};

const getRecord = (key: string, now: number) => {
  const record = pruneRecord(
    rateLimitStore.get(key) ?? { attempts: [], blockedUntil: 0 },
    now,
  );

  rateLimitStore.set(key, record);
  return record;
};

export const getRateLimitStatus = (keys: string[]) => {
  const now = Date.now();
  const retryAfterMs = keys.reduce((maxRetryAfterMs, key) => {
    const record = getRecord(key, now);
    return Math.max(maxRetryAfterMs, record.blockedUntil - now);
  }, 0);

  return {
    limited: retryAfterMs > 0,
    retryAfterMs,
  };
};

export const recordRateLimitFailure = (keys: string[]) => {
  const now = Date.now();

  keys.forEach((key) => {
    const record = getRecord(key, now);
    record.attempts.push(now);

    if (record.attempts.length >= MAX_FAILURES) {
      record.blockedUntil = now + LOCKOUT_MS;
      record.attempts = [];
    }

    rateLimitStore.set(key, record);
  });
};

export const clearRateLimit = (keys: string[]) => {
  keys.forEach((key) => {
    rateLimitStore.delete(key);
  });
};
