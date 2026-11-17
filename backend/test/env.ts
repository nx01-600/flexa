// The e2e suite only ever talks to this database: the dev data in "flexa" is never touched.
export const TEST_DATABASE_URL = 'postgresql://flexa:flexa@localhost:5433/flexa_test';
export const TEST_JWT_SECRET = 'e2e-test-secret-0123456789-abcdef';

export function assertTestDatabase(url = process.env.DATABASE_URL) {
  if (!url?.endsWith('/flexa_test')) throw new Error(`e2e tests must run against the flexa_test database, got ${url}`);
}

// Assigned directly (not defaulted): ConfigModule would otherwise fill missing keys from backend/.env.
export function applyTestEnv() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.NODE_ENV = 'test';
  // High on purpose: only throttle.e2e-spec.ts lowers it.
  process.env.THROTTLE_LIMIT = '100000';
  assertTestDatabase();
}
