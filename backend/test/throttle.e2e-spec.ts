import { bootApp, type TestApp } from './helpers/app.js';

// The only file that lowers the limit: the shared setup keeps it high for everything else.
const previous = process.env.THROTTLE_LIMIT;
process.env.THROTTLE_LIMIT = '5';

let t: TestApp;

beforeAll(async () => {
  t = await bootApp();
});
afterAll(async () => {
  await t.app.close();
  process.env.THROTTLE_LIMIT = previous;
});

const LIMIT = 5;

describe('brute-force throttle', () => {
  it('login: the 6th attempt within a minute is 429', async () => {
    for (let i = 1; i <= LIMIT; i++) {
      const res = await t.post('/auth/login').send({ email: `nobody${i}@example.com`, password: 'wrong-password' });
      expect(res.status, `attempt ${i}`).toBe(401);
    }
    const blocked = await t.post('/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Too Many Requests/);
  });

  it('register: the 6th attempt is 429', async () => {
    for (let i = 1; i <= LIMIT; i++) {
      const res = await t.post('/auth/register').send({ docNumber: '123', email: `nobody${i}@example.com`, password: 'long-enough-password' });
      expect(res.status, `attempt ${i}`).toBe(404);
    }
    const blocked = await t.post('/auth/register').send({ docNumber: '123', email: 'nobody@example.com', password: 'long-enough-password' });
    expect(blocked.status).toBe(429);
  });


  it('health and every other route are never throttled', async () => {
    for (let i = 0; i < LIMIT * 3; i++) {
      expect((await t.get('/health')).status).toBe(200);
      // 401 (no token), not 429: the guard only protects the three auth routes.
      expect((await t.get('/auth/me')).status).toBe(401);
    }
  });
});
