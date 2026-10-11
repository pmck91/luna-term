import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { createApp } from '../server/app';
import { resetAdminPassword } from '../server/recovery';
import type { Config } from '../server/config';
const origin = 'http://localhost:5173', token = 'test-setup-token-abcdefghijklmnopqrstuvwxyz';
let env: ReturnType<typeof createApp>, dir: string, config: Config;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'luna-test-')); config = { port: 3000, production: false, databasePath: join(dir, 'db.sqlite'), mediaPath: join(dir, 'media'), origin, sessionSecret: 'test-session-secret-abcdefghijklmnopqrstuvwxyz', setupToken: token, repositoryUrl: null, trustProxy: [], contactLimit: 5 }; env = createApp(config); });
afterEach(() => { env.db.close(); rmSync(dir, { recursive: true, force: true }); });
async function admin() {
  const agent = request.agent(env.app); const status = await agent.get('/api/auth/status');
  const setup = await agent.post('/api/auth/setup').set('Origin', origin).set('X-CSRF-Token', status.body.csrf).send({ token, username: 'owner', password: 'test-password-with-length' });
  expect(setup.status).toBe(201); return { agent, csrf: setup.body.csrf };
}
const message = () => ({ name: 'Visitor', email: 'visitor@example.com', subject: 'Hello', message: 'First line\nSecond line', submissionId: randomUUID() });
describe('admin protection and setup', () => {
  it('reports a production proxy configuration error before issuing an unusable CSRF token', async () => {
    env.db.close(); env = createApp({ ...config, production: true, origin: 'https://term.pmck.ie' });
    for (const forwarded of [undefined, 'https']) {
      const req = request(env.app).get('/api/auth/status');
      if (forwarded) req.set('X-Forwarded-Proto', forwarded);
      const status = await req;
      expect(status.status).toBe(503);
      expect(status.body.error).toContain('TRUST_PROXY');
      expect(status.body.csrf).toBeUndefined();
      expect(status.headers['set-cookie']).toBeUndefined();
      expect(status.headers['cache-control']).toBe('no-store');
    }
    expect(env.db.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 });
  });
  it('sets secure cookies and completes setup behind a trusted HTTPS proxy', async () => {
    const productionOrigin = 'https://term.pmck.ie';
    env.db.close(); env = createApp({ ...config, production: true, origin: productionOrigin, trustProxy: ['127.0.0.1'] });
    const insecure = await request(env.app).get('/api/auth/status');
    expect(insecure.status).toBe(503);
    const status = await request(env.app).get('/api/auth/status').set('X-Forwarded-Proto', 'https');
    expect(status.status).toBe(200);
    const cookie = status.headers['set-cookie'][0];
    expect(cookie).toMatch(/^__Host-luna\.sid=/);
    expect(cookie).toContain('Secure'); expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Strict');
    const sessionCookie = cookie.split(';')[0];
    const setup = () => request(env.app).post('/api/auth/setup').set('Origin', productionOrigin).set('X-Forwarded-Proto', 'https').set('Cookie', sessionCookie);
    expect((await setup().set('X-CSRF-Token', 'wrong').send({ token, username: 'owner', password: 'test-password-with-length' })).status).toBe(403);
    const result = await setup().set('X-CSRF-Token', status.body.csrf).send({ token, username: 'owner', password: 'test-password-with-length' });
    expect(result.status).toBe(201);
    const rotatedCookie = result.headers['set-cookie'][0].split(';')[0];
    expect(rotatedCookie).not.toBe(sessionCookie);
    expect((await request(env.app).get('/api/admin/entries').set('X-Forwarded-Proto', 'https').set('Cookie', rotatedCookie)).status).toBe(200);
  });
  it('recovers an account and invalidates every previous session', async () => {
    const { agent } = await admin(); await resetAdminPassword(env.db, 'a-new-password-for-recovery');
    expect((await agent.get('/api/admin/entries')).status).toBe(401);
    const status = await agent.get('/api/auth/status');
    expect((await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', status.body.csrf).send({ username: 'owner', password: 'test-password-with-length' })).status).toBe(401);
    expect((await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', status.body.csrf).send({ username: 'owner', password: 'a-new-password-for-recovery' })).status).toBe(200);
    expect((await agent.get('/api/admin/entries')).status).toBe(200);
  });
  it('protects all private APIs and redirects protected pages', async () => { for (const path of ['entries', 'contacts', 'socials']) expect((await request(env.app).get(`/api/admin/${path}`)).status).toBe(401); expect((await request(env.app).get('/admin')).headers.location).toBe('/admin/setup'); });
  it('requires correct setup token, origin, and CSRF', async () => { const agent = request.agent(env.app); const status = await agent.get('/api/auth/status'); const b = { token: 'wrong', username: 'owner', password: 'test-password-with-length' }; expect((await agent.post('/api/auth/setup').send(b)).status).toBe(403); expect((await agent.post('/api/auth/setup').set('Origin', origin).send(b)).status).toBe(403); expect((await agent.post('/api/auth/setup').set('Origin', origin).set('X-CSRF-Token', status.body.csrf).send(b)).status).toBe(403); });
  it('hashes passwords, rotates sessions, and disables subsequent setup', async () => { const { agent, csrf } = await admin(); const row = env.db.prepare('SELECT password_hash FROM admins').get() as { password_hash: string }; expect(row.password_hash).toMatch(/^\$argon2id\$/); expect(await argon2.verify(row.password_hash, 'test-password-with-length')).toBe(true); expect((await agent.post('/api/auth/setup').set('Origin', origin).set('X-CSRF-Token', csrf).send({ token, username: 'other', password: 'test-password-with-length' })).status).toBe(409); expect((await agent.get('/api/admin/entries')).status).toBe(200); });
  it('handles concurrent first-account requests atomically', async () => { const a = request.agent(env.app), b = request.agent(env.app); const aa = await a.get('/api/auth/status'), bb = await b.get('/api/auth/status'); const responses = await Promise.all([a.post('/api/auth/setup').set('Origin', origin).set('X-CSRF-Token', aa.body.csrf).send({ token, username: 'one', password: 'test-password-with-length' }), b.post('/api/auth/setup').set('Origin', origin).set('X-CSRF-Token', bb.body.csrf).send({ token, username: 'two', password: 'test-password-with-length' })]); expect(responses.map(r => r.status).sort()).toEqual([201, 409]); });
  it('requires CSRF for writes and invalidates sessions on logout', async () => { const { agent, csrf } = await admin(); expect((await agent.put('/api/admin/socials').set('Origin', origin).send([])).status).toBe(403); expect((await agent.post('/api/auth/logout').set('Origin', origin).set('X-CSRF-Token', csrf)).status).toBe(200); expect((await agent.get('/api/admin/entries')).status).toBe(401); expect((await request(env.app).get('/admin')).headers.location).toBe('/admin/login'); });
  it('rejects invalid credentials and expires absolute sessions', async () => { const { agent } = await admin(); env.db.prepare('UPDATE sessions SET expires=?').run(0); expect((await agent.get('/api/admin/entries')).status).toBe(401); const status = await agent.get('/api/auth/status'); expect((await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', status.body.csrf).send({ username: 'owner', password: 'wrong' })).status).toBe(401); const before = status.headers['set-cookie']; const login = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', status.body.csrf).send({ username: 'owner', password: 'test-password-with-length' }); expect(login.status).toBe(200); expect(login.headers['set-cookie']).not.toEqual(before); });
});
describe('content and media', () => {
  it('keeps drafts private and supports publishing, updating, and deletion', async () => { const { agent, csrf } = await admin(); const b = { kind: 'blog', slug: 'private', title: 'Private', markdown: '# Secret', published: false }; const created = await agent.post('/api/admin/entries').set('Origin', origin).set('X-CSRF-Token', csrf).send(b); expect(created.status).toBe(201); expect((await request(env.app).get('/api/public/catalog')).body.entries.some((e: { slug: string }) => e.slug === 'private')).toBe(false); expect((await agent.put(`/api/admin/entries/${created.body.id}`).set('Origin', origin).set('X-CSRF-Token', csrf).send({ ...b, published: true })).status).toBe(200); expect((await request(env.app).get('/api/public/catalog')).body.entries.some((e: { slug: string }) => e.slug === 'private')).toBe(true); expect((await agent.delete(`/api/admin/entries/${created.body.id}`).set('Origin', origin).set('X-CSRF-Token', csrf)).status).toBe(200); });
  it('validates slugs, duplicates, and social URLs', async () => { const { agent, csrf } = await admin(); const put = (body: object) => agent.post('/api/admin/entries').set('Origin', origin).set('X-CSRF-Token', csrf).send(body); expect((await put({ kind: 'project', slug: '../escape', title: 'Test', markdown: '', published: true })).status).toBe(400); expect((await put({ kind: 'project', slug: 'portfolio', title: 'Duplicate', markdown: '', published: false })).status).toBe(409); expect((await agent.put('/api/admin/socials').set('Origin', origin).set('X-CSRF-Token', csrf).send([{ label: 'Bad', url: 'javascript:alert(1)' }])).status).toBe(400); });
  it('validates media signatures and makes only published media public', async () => { const { agent, csrf } = await admin(); const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1kAAAAASUVORK5CYII=', 'base64'); const bad = await agent.post('/api/admin/media').set('Origin', origin).set('X-CSRF-Token', csrf).attach('file', Buffer.from('<script>alert(1)</script>'), 'fake.png'); expect(bad.status).toBe(400); const upload = await agent.post('/api/admin/media').set('Origin', origin).set('X-CSRF-Token', csrf).attach('file', png, 'cat.png'); expect(upload.status).toBe(201); expect((await request(env.app).get(upload.body.url)).status).toBe(404); expect((await agent.get(upload.body.url)).status).toBe(200); const body = { kind: 'project', slug: 'media', title: 'Media', markdown: `![Cat](${upload.body.url})`, published: true }; const entry = await agent.post('/api/admin/entries').set('Origin', origin).set('X-CSRF-Token', csrf).send(body); expect((await request(env.app).get(upload.body.url)).headers['content-type']).toBe('image/png'); await agent.put(`/api/admin/entries/${entry.body.id}`).set('Origin', origin).set('X-CSRF-Token', csrf).send({ ...body, published: false }); expect((await request(env.app).get(upload.body.url)).status).toBe(404); expect((await request(env.app).get('/media/../../.env')).status).toBe(404); });
});
describe('contact submissions', () => {
  it('validates fields, persists privately, and deduplicates retries', async () => { const b = message(); expect((await request(env.app).post('/api/contact').set('Origin', origin).send({ ...b, email: 'invalid' })).status).toBe(400); expect((await request(env.app).post('/api/contact').set('Origin', origin).send(b)).status).toBe(201); expect((await request(env.app).post('/api/contact').set('Origin', origin).send(b)).status).toBe(200); expect(env.db.prepare('SELECT count(*) AS n FROM contacts').get()).toEqual({ n: 1 }); expect((await request(env.app).get('/api/admin/contacts')).status).toBe(401); const { agent, csrf } = await admin(); const contacts = await agent.get('/api/admin/contacts'); expect(contacts.body[0].message).toBe(b.message); const id = contacts.body[0].id; await agent.patch(`/api/admin/contacts/${id}`).set('Origin', origin).set('X-CSRF-Token', csrf).send({ read: true }); expect((await agent.get('/api/admin/contacts')).body[0].read).toBe(true); await agent.delete(`/api/admin/contacts/${id}`).set('Origin', origin).set('X-CSRF-Token', csrf); expect((await agent.get('/api/admin/contacts')).body).toEqual([]); });
  it('rate limits and refuses cross-origin writes', async () => { expect((await request(env.app).post('/api/contact').set('Origin', 'https://evil.example').send(message())).status).toBe(403); for (let i = 0; i < 5; i++) expect((await request(env.app).post('/api/contact').set('Origin', origin).send(message())).status).toBe(201); expect((await request(env.app).post('/api/contact').set('Origin', origin).send(message())).status).toBe(429); });
  it('has a database-backed health endpoint', async () => expect((await request(env.app).get('/healthz')).body).toEqual({ status: 'ok' }));
});
