import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app';
import type { Config } from '../server/config';
const origin = 'http://localhost:5173', token = 'test-setup-token-abcdefghijklmnopqrstuvwxyz';
const png = readFileSync('tests/fixtures/sample.png');
let app: ReturnType<typeof createApp>, directory: string, config: Config;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'luna-pictures-')); config = { port: 3000, production: false, databasePath: join(directory, 'db.sqlite'), mediaPath: join(directory, 'media'), origin, sessionSecret: 'test-session-secret-abcdefghijklmnopqrstuvwxyz', setupToken: token, repositoryUrl: null, trustProxy: [], contactLimit: 5 }; app = createApp(config); });
afterEach(() => { app.db.close(); rmSync(directory, { recursive: true, force: true }); });
async function admin() {
  const agent = request.agent(app.app), status = await agent.get('/api/auth/status');
  const response = await agent.post('/api/auth/setup').set('Origin', origin).set('X-CSRF-Token', status.body.csrf).send({ token, username: 'tester', password: 'test-password-with-length' });
  expect(response.status).toBe(201); const csrf = response.body.csrf as string;
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  return { agent, csrf, cookie, headers: { Origin: origin, 'X-CSRF-Token': csrf } };
}
describe('pictures API and persistence', () => {
  it('migrates an existing database without changing its entries or admin and reopens safely', async () => {
    const { agent, cookie } = await admin();
    const entries = (await agent.get('/api/admin/entries')).body;
    app.db.exec('DROP TABLE pictures; DROP TABLE picture_albums; DELETE FROM migrations WHERE version=2;');
    app.db.close(); app = createApp(config);
    expect((await request(app.app).get('/api/admin/entries').set('Cookie', cookie)).body).toEqual(entries);
    expect(app.db.prepare('SELECT version FROM migrations ORDER BY version').all()).toEqual([{ version: 1 }, { version: 2 }]);
    app.db.close(); app = createApp(config);
    expect((await request(app.app).get('/api/public/catalog')).body).toMatchObject({ albums: [], pictures: [] });
  });
  it('protects all writes, admin APIs and the pictures page before any upload is stored', async () => {
    for (const path of ['/api/admin/pictures', '/api/admin/picture-albums']) {
      expect((await request(app.app).get(path)).status).toBe(401);
      expect((await request(app.app).post(path).send({ name: 'cat' })).status).toBe(401);
      expect((await request(app.app).put(path + '/' + randomUUID()).send({ name: 'cat' })).status).toBe(401);
      expect((await request(app.app).delete(path + '/' + randomUUID())).status).toBe(401);
    }
    expect((await request(app.app).get('/admin/pictures')).headers.location).toBe('/admin/setup');
    const { agent, headers } = await admin();
    expect((await request(app.app).get('/admin/pictures')).headers.location).toBe('/admin/login');
    expect((await agent.post('/api/admin/pictures').set('Origin', origin).field('name', 'Cat').attach('file', png, 'cat.png')).status).toBe(403);
    expect((await agent.post('/api/admin/picture-albums').set({ ...headers, Origin: 'https://other.example' }).send({ name: 'cats' })).status).toBe(403);
    expect(app.db.prepare('SELECT count(*) AS count FROM pictures').get()).toEqual({ count: 0 });
    expect(readdirSync(config.mediaPath)).toEqual(['.incoming']);
    expect(readdirSync(join(config.mediaPath, '.incoming'))).toEqual([]);
  });
  it('creates nested albums, prevents cycles and duplicate directory names, and only deletes empty albums', async () => {
    const { agent, headers } = await admin();
    const create = (name: string, parentId: string | null = null) => agent.post('/api/admin/picture-albums').set(headers).send({ name, parentId });
    const parent = await create('holidays'); expect(parent.status).toBe(201);
    const child = await create('ireland', parent.body.id); expect(child.status).toBe(201);
    expect((await create('holidays')).status).toBe(409);
    expect((await create('ireland', parent.body.id)).status).toBe(409);
    expect((await create('ireland')).status).toBe(201);
    for (const name of ['../outside', 'a/b', 'view', 'Cat Pictures']) expect((await create(name)).status).toBe(400);
    expect((await create('missing', randomUUID())).status).toBe(400);
    for (const parentId of [parent.body.id, child.body.id]) expect((await agent.put(`/api/admin/picture-albums/${parent.body.id}`).set(headers).send({ name: 'holidays', parentId })).status).toBe(400);
    expect((await agent.delete(`/api/admin/picture-albums/${parent.body.id}`).set(headers)).status).toBe(409);
    expect((await agent.put(`/api/admin/picture-albums/${child.body.id}`).set(headers).send({ name: 'coast', parentId: null })).status).toBe(200);
    expect((await agent.delete(`/api/admin/picture-albums/${parent.body.id}`).set(headers)).status).toBe(200);
    expect((await agent.delete(`/api/admin/picture-albums/${parent.body.id}`).set(headers)).status).toBe(404);
  });
  it('uploads independently, renames and moves pictures, preserves media across restarts and removes deleted files', async () => {
    const { agent, headers, cookie } = await admin();
    const album = await agent.post('/api/admin/picture-albums').set(headers).send({ name: 'cats' });
    const postMedia = await agent.post('/api/admin/media').set(headers).attach('file', png, 'post.png'); expect(postMedia.status).toBe(201);
    const upload = await agent.post('/api/admin/pictures').set(headers).field('name', 'Luna at the window').field('albumId', album.body.id).attach('file', png, 'camera.png');
    expect(upload.status).toBe(201); expect(upload.body).toMatchObject({ name: 'Luna at the window', filename: 'luna-at-the-window.png', albumId: album.body.id });
    expect(upload.body.storage_name).toBeUndefined();
    const picture = upload.body;
    expect((await request(app.app).get(picture.url)).headers['content-type']).toBe('image/png');
    expect((await request(app.app).get(postMedia.body.url)).status).toBe(404);
    expect(app.db.prepare('SELECT count(*) AS count FROM media').get()).toEqual({ count: 1 });
    expect((await request(app.app).get('/api/public/catalog')).body.pictures).toEqual([picture]);
    expect((await agent.delete(`/api/admin/picture-albums/${album.body.id}`).set(headers)).status).toBe(409);
    const edit = await agent.put(`/api/admin/pictures/${picture.id}`).set(headers).send({ name: 'Luna asleep', albumId: null });
    expect(edit.status).toBe(200); expect(edit.body).toMatchObject({ filename: 'luna-asleep.png', albumId: null });
    expect((await agent.put(`/api/admin/pictures/${picture.id}`).set(headers).send({ name: 'Lost', albumId: randomUUID() })).status).toBe(400);
    expect((await agent.get('/api/admin/pictures')).body.pictures[0].name).toBe('Luna asleep');
    app.db.close(); app = createApp(config);
    expect((await request(app.app).get('/api/public/catalog')).body.pictures[0]).toMatchObject({ name: 'Luna asleep', filename: 'luna-asleep.png' });
    expect((await request(app.app).get(picture.url)).status).toBe(200);
    const storage = app.db.prepare('SELECT storage_name FROM pictures WHERE id=?').get(picture.id) as { storage_name: string };
    expect((await request(app.app).delete(`/api/admin/pictures/${picture.id}`).set(headers).set('Cookie', cookie)).status).toBe(200);
    expect(existsSync(join(config.mediaPath, storage.storage_name))).toBe(false);
    expect((await request(app.app).get(picture.url)).status).toBe(404);
    expect((await request(app.app).get(postMedia.body.url).set('Cookie', cookie)).status).toBe(200);
    expect((await request(app.app).delete(`/api/admin/picture-albums/${album.body.id}`).set(headers).set('Cookie', cookie)).status).toBe(200);
  });
  it('rejects invalid images and oversized uploads, and cleans temporary or duplicate files', async () => {
    const { agent, headers } = await admin();
    const upload = (name: string, file = png, filename = 'cat.png') => agent.post('/api/admin/pictures').set(headers).field('name', name).attach('file', file, filename);
    for (const file of [Buffer.from('<svg onload="alert(1)"></svg>'), readFileSync('tests/fixtures/sample.mp4')]) expect((await upload('Bad', file)).status).toBe(400);
    expect((await upload(' ')).status).toBe(400);
    expect((await upload('Large', Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(400);
    expect((await upload('Luna')).status).toBe(201);
    expect((await upload('Luna')).status).toBe(409);
    expect(readdirSync(join(config.mediaPath, '.incoming'))).toEqual([]);
    expect(readdirSync(config.mediaPath).filter(name => name.startsWith('picture-'))).toHaveLength(1);
    expect((await upload('False suffix', png, 'cat.jpg')).body.filename).toBe('false-suffix.png');
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const retained = await upload('JPEG extension', jpeg, 'camera.jpeg'); expect(retained.status).toBe(201); expect(retained.body.filename).toBe('jpeg-extension.jpeg');
  });
});
