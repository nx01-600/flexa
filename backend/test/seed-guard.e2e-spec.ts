import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from './env.js';

const cwd = fileURLToPath(new URL('..', import.meta.url));

// Runs prisma/seed.ts in a child process; it must refuse before it touches any table.
function runSeed(env: Record<string, string>) {
  const base = { ...process.env, ALLOW_SEED: '' };
  const res = spawnSync('npx', ['tsx', 'prisma/seed.ts'], { cwd, env: { ...base, ...env }, shell: true, encoding: 'utf8', timeout: 90_000 });
  return { status: res.status, output: `${res.stdout}${res.stderr}` };
}

describe('seed safety guard', () => {
  it('refuses a non-local database host unless ALLOW_SEED=1', () => {
    const res = runSeed({ DATABASE_URL: 'postgresql://flexa:flexa@db.example.com:5432/flexa_test', NODE_ENV: 'development' });
    expect(res.status).not.toBe(0);
    expect(res.output).toMatch(/Refusing to seed/);
    expect(res.output).toMatch(/not local/);
  });

  it('always refuses in production, even with ALLOW_SEED=1', () => {
    const res = runSeed({ DATABASE_URL: TEST_DATABASE_URL, NODE_ENV: 'production', ALLOW_SEED: '1' });
    expect(res.status).not.toBe(0);
    expect(res.output).toMatch(/Refusing to seed: NODE_ENV=production/);
  });
});
