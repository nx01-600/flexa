import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertTestDatabase, TEST_DATABASE_URL } from './env.js';

// Migrates and reseeds flexa_test once per run, so leftovers from earlier runs never leak into this one.
export default function setup() {
  assertTestDatabase(TEST_DATABASE_URL);
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL, ALLOW_SEED: '1', NODE_ENV: 'test' };
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'pipe' });
}
