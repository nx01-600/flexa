import { bootApp, type TestApp } from './helpers/app.js';
import { createCompany, createFlexaAdmin, createWorker } from './helpers/fixtures.js';

let t: TestApp;
let own: Awaited<ReturnType<typeof createCompany>>;
let foreign: Awaited<ReturnType<typeof createCompany>>;
let tokens: { worker: string; admin: string; finance: string; flexa: string; foreignAdmin: string; foreignFinance: string };

beforeAll(async () => {
  t = await bootApp();
  [own, foreign] = [await createCompany(t.prisma), await createCompany(t.prisma)];
  const worker = await createWorker(t.prisma, own.company.id);
  tokens = {
    worker: t.tokenFor(worker.user!, worker.worker.id),
    admin: t.tokenFor(own.admin),
    finance: t.tokenFor(own.finance),
    flexa: t.tokenFor(await createFlexaAdmin(t.prisma)),
    foreignAdmin: t.tokenFor(foreign.admin),
    foreignFinance: t.tokenFor(foreign.finance),
  };
});
afterAll(() => t.app.close());

// A ticket opened by the worker.
async function openTicket() {
  const res = await t.post('/support/tickets', tokens.worker).send({ category: 'Otro', subject: 'No me llegó el dinero', description: 'Hice un retiro y no lo veo' });
  expect(res.status).toBe(201);
  return res.body.id as string;
}
const statusOf = async (id: string) => (await t.prisma.supportTicket.findUniqueOrThrow({ where: { id } })).status;
const reply = (id: string, token: string) => t.post(`/support/tickets/${id}/messages`, token).send({ body: 'Respuesta de prueba' });
const setStatus = (id: string, token: string, status = 'CLOSED') => t.patch(`/support/tickets/${id}/status`, token).send({ status });

describe('replying to a worker ticket', () => {
  it('Finance cannot, the company admin, the worker and FLEXA can', async () => {
    const id = await openTicket();
    expect((await reply(id, tokens.finance)).status).toBe(403);
    expect(await t.prisma.ticketMessage.count({ where: { ticketId: id } })).toBe(0);

    for (const who of ['admin', 'worker', 'flexa'] as const) expect((await reply(id, tokens[who])).status, who).toBe(201);
    expect(await t.prisma.ticketMessage.count({ where: { ticketId: id } })).toBe(3);
  });

  it('staff of another company gets a 404, and so does Finance reading it', async () => {
    const id = await openTicket();
    expect((await reply(id, tokens.foreignAdmin)).status).toBe(404);
    expect((await t.get(`/support/tickets/${id}`, tokens.foreignFinance)).status).toBe(404);
    expect((await t.get(`/support/tickets/${id}`, tokens.finance)).status).toBe(200);
    expect((await t.get(`/support/tickets/${id}`, tokens.admin)).status).toBe(200);
  });

  it('nobody replies to a closed ticket', async () => {
    const id = await openTicket();
    expect((await setStatus(id, tokens.worker)).status).toBe(200);
    expect((await reply(id, tokens.admin)).status).toBe(400);
  });
});

describe('closing a worker ticket', () => {
  it('company staff cannot close it, a worker ticket of another company is a 404', async () => {
    const id = await openTicket();
    expect((await setStatus(id, tokens.admin)).status).toBe(403);
    expect((await setStatus(id, tokens.finance)).status).toBe(403);
    expect((await setStatus(id, tokens.foreignAdmin)).status).toBe(404);
    expect(await statusOf(id)).toBe('OPEN');
  });

  it('the owning worker can close it, but not set other statuses', async () => {
    const id = await openTicket();
    expect((await setStatus(id, tokens.worker, 'IN_PROGRESS')).status).toBe(403);
    expect((await setStatus(id, tokens.worker)).status).toBe(200);
    expect(await statusOf(id)).toBe('CLOSED');
  });

  it('FLEXA can set any status', async () => {
    const id = await openTicket();
    expect((await setStatus(id, tokens.flexa, 'IN_PROGRESS')).status).toBe(200);
    expect((await setStatus(id, tokens.flexa)).status).toBe(200);
    expect(await statusOf(id)).toBe('CLOSED');
  });

  it('the company admin can close a ticket opened by company staff', async () => {
    const res = await t.post('/support/tickets', tokens.finance).send({ category: 'Otro', subject: 'Duda de conciliación', description: 'Necesito ayuda con el cierre' });
    expect(res.status).toBe(201);
    expect((await setStatus(res.body.id, tokens.admin)).status).toBe(200);
    expect(await statusOf(res.body.id)).toBe('CLOSED');
  });

  it('Finance can answer FLEXA on a ticket Finance opened', async () => {
    const res = await t.post('/support/tickets', tokens.finance).send({ category: 'Otro', subject: 'Duda de facturación', description: 'Necesito el detalle' });
    expect((await reply(res.body.id, tokens.flexa)).status).toBe(201);
    expect(await statusOf(res.body.id)).toBe('WAITING_USER');
    expect((await reply(res.body.id, tokens.finance)).status).toBe(201);
    expect(await statusOf(res.body.id)).toBe('IN_PROGRESS');
  });
});
