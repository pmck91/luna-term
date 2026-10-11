import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { z } from 'zod';
import { openDatabase, mapEntry, syncMedia } from './db';
import { SqliteSessionStore } from './session-store';
import type { Config } from './config';
import { accountSchema, contactSchema, entrySchema, socialSchema } from '../shared/models';

declare module 'express-session' { interface SessionData { admin?: number; csrf?: string; authenticatedAt?: number } }
const same = (a: string, b: string) => { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); };
export function createApp(config: Config) {
  const db = openDatabase(config.databasePath); mkdirSync(config.mediaPath, { recursive: true });
  const app = express(); app.disable('x-powered-by'); app.set('trust proxy', config.trustProxy.length ? config.trustProxy : false);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'https:', 'data:'], mediaSrc: ["'self'", 'https:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameSrc: ["'none'"], upgradeInsecureRequests: config.production ? [] : null } }, crossOriginResourcePolicy: { policy: 'same-origin' } }));
  app.use(express.json({ limit: '150kb' }));
  app.use('/api/auth', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (config.production && !req.secure) {
      res.status(503).json({ error: "Admin sessions require HTTPS. Check your reverse proxy's X-Forwarded-Proto header and set TRUST_PROXY to its IP address." });
      return;
    }
    next();
  });
  const cookieName = config.production ? '__Host-luna.sid' : 'luna.sid';
  app.use(session({ name: cookieName, secret: config.sessionSecret, store: new SqliteSessionStore(db), resave: false, saveUninitialized: false, rolling: true, cookie: { httpOnly: true, secure: config.production, sameSite: 'strict', maxAge: 8 * 3600000, path: '/' } }));
  const limiter = (limit: number, windowMs: number, message: string) => rateLimit({ limit, windowMs, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: message } });
  const authLimit = limiter(10, 15 * 60000, 'Too many attempts. Try again in 15 minutes.');
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session.admin || !req.session.authenticatedAt || Date.now() - req.session.authenticatedAt > 8 * 3600000) { res.status(401).json({ error: 'Sign in to continue.' }); return; }
    next();
  }
  function originCheck(req: Request, res: Response, next: NextFunction) {
    if (req.get('origin') !== config.origin) { res.status(403).json({ error: 'Invalid request origin.' }); return; } next();
  }
  function csrf(req: Request, res: Response, next: NextFunction) {
    if (!req.session.csrf || !same(req.get('x-csrf-token') || '', req.session.csrf)) { res.status(403).json({ error: 'Invalid CSRF token. Reload and try again.' }); return; } next();
  }
  const hasAdmin = () => !!db.prepare('SELECT 1 FROM admins WHERE id=1').get();
  const authValid = (req: Request) => !!req.session.admin && !!req.session.authenticatedAt && Date.now() - req.session.authenticatedAt < 8 * 3600000;
  app.get('/healthz', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); });
  app.get('/api/public/catalog', (_req, res) => {
    const entries = (db.prepare('SELECT * FROM entries WHERE published=1 ORDER BY created_at DESC').all() as Record<string, unknown>[]).map(mapEntry);
    const socials = JSON.parse((db.prepare("SELECT value FROM settings WHERE key='socials'").get() as { value: string }).value);
    res.set('Cache-Control', 'no-store').json({ entries, socials, repositoryUrl: config.repositoryUrl });
  });
  app.post('/api/contact', originCheck, limiter(config.contactLimit, 15 * 60000, 'Message limit reached. Try again in 15 minutes.'), (req, res) => {
    const body = contactSchema.parse(req.body);
    const existing = db.prepare('SELECT id FROM contacts WHERE submission_id=?').get(body.submissionId) as { id: string } | undefined;
    if (existing) { res.json({ ok: true }); return; }
    db.prepare('INSERT INTO contacts (id,submission_id,name,email,subject,message,created_at) VALUES (?,?,?,?,?,?,?)').run(randomUUID(), body.submissionId, body.name, body.email, body.subject, body.message, new Date().toISOString());
    res.status(201).json({ ok: true });
  });
  app.get('/api/auth/status', (req, res) => {
    req.session.csrf ??= randomBytes(32).toString('hex');
    res.set('Cache-Control', 'no-store').json({ setupRequired: !hasAdmin(), authenticated: authValid(req), csrf: req.session.csrf });
  });
  app.post('/api/auth/setup', authLimit, originCheck, csrf, async (req, res) => {
    if (hasAdmin()) { res.status(409).json({ error: 'Account setup is already complete.' }); return; }
    const body = accountSchema.extend({ token: z.string().max(256) }).parse(req.body);
    if (!same(body.token, config.setupToken)) { res.status(403).json({ error: 'Invalid setup token.' }); return; }
    const hash = await argon2.hash(body.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    try { db.prepare('INSERT INTO admins VALUES (1,?,?)').run(body.username, hash); }
    catch { res.status(409).json({ error: 'Account setup is already complete.' }); return; }
    await new Promise<void>((resolvePromise, reject) => req.session.regenerate(err => err ? reject(err) : resolvePromise()));
    req.session.admin = 1; req.session.authenticatedAt = Date.now(); req.session.csrf = randomBytes(32).toString('hex');
    res.status(201).json({ ok: true, csrf: req.session.csrf });
  });
  app.post('/api/auth/login', authLimit, originCheck, csrf, async (req, res) => {
    const body = z.object({ username: z.string().max(80), password: z.string().max(256) }).parse(req.body);
    const admin = db.prepare('SELECT * FROM admins WHERE id=1').get() as { username: string; password_hash: string } | undefined;
    if (!admin || !(await argon2.verify(admin.password_hash, body.password)) || body.username !== admin.username) { res.status(401).json({ error: 'Invalid username or password.' }); return; }
    await new Promise<void>((resolvePromise, reject) => req.session.regenerate(err => err ? reject(err) : resolvePromise()));
    req.session.admin = 1; req.session.authenticatedAt = Date.now(); req.session.csrf = randomBytes(32).toString('hex'); res.json({ ok: true, csrf: req.session.csrf });
  });
  app.post('/api/auth/logout', requireAuth, originCheck, csrf, (req, res, next) => req.session.destroy(err => { if (err) { next(err); return; } res.clearCookie(cookieName, { path: '/', secure: config.production, httpOnly: true, sameSite: 'strict' }).json({ ok: true }); }));
  app.use('/api/admin', requireAuth, (req, res, next) => { res.set('Cache-Control', 'no-store'); if (['GET', 'HEAD'].includes(req.method)) next(); else originCheck(req, res, () => csrf(req, res, next)); });
  app.get('/api/admin/entries', (_req, res) => res.json((db.prepare('SELECT * FROM entries ORDER BY updated_at DESC').all() as Record<string, unknown>[]).map(mapEntry)));
  app.post('/api/admin/entries', (req, res) => {
    const b = entrySchema.parse(req.body); const id = randomUUID(), now = new Date().toISOString();
    db.transaction(() => { db.prepare('INSERT INTO entries VALUES (?,?,?,?,?,?,?,?)').run(id, b.kind, b.slug, b.title, b.markdown, Number(b.published), now, now); syncMedia(db, id, b.markdown); })();
    res.status(201).json(mapEntry(db.prepare('SELECT * FROM entries WHERE id=?').get(id) as Record<string, unknown>));
  });
  app.put('/api/admin/entries/:id', (req, res) => {
    const b = entrySchema.parse(req.body); const id = req.params.id as string;
    if (!db.prepare('SELECT 1 FROM entries WHERE id=?').get(id)) { res.status(404).json({ error: 'Entry not found.' }); return; }
    db.transaction(() => { db.prepare('UPDATE entries SET kind=?,slug=?,title=?,markdown=?,published=?,updated_at=? WHERE id=?').run(b.kind, b.slug, b.title, b.markdown, Number(b.published), new Date().toISOString(), id); syncMedia(db, id, b.markdown); })();
    res.json(mapEntry(db.prepare('SELECT * FROM entries WHERE id=?').get(id) as Record<string, unknown>));
  });
  app.delete('/api/admin/entries/:id', (req, res) => { const result = db.prepare('DELETE FROM entries WHERE id=?').run(req.params.id); res.status(result.changes ? 200 : 404).json(result.changes ? { ok: true } : { error: 'Entry not found.' }); });
  app.get('/api/admin/socials', (_req, res) => res.json(JSON.parse((db.prepare("SELECT value FROM settings WHERE key='socials'").get() as { value: string }).value)));
  app.put('/api/admin/socials', (req, res) => { const links = socialSchema.parse(req.body); db.prepare("UPDATE settings SET value=? WHERE key='socials'").run(JSON.stringify(links)); res.json(links); });
  app.get('/api/admin/contacts', (_req, res) => res.json((db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all() as Record<string, unknown>[]).map(r => ({ id: r.id, name: r.name, email: r.email, subject: r.subject, message: r.message, read: !!r.is_read, createdAt: r.created_at }))));
  app.patch('/api/admin/contacts/:id', (req, res) => { const b = z.object({ read: z.boolean() }).parse(req.body); const r = db.prepare('UPDATE contacts SET is_read=? WHERE id=?').run(Number(b.read), req.params.id); res.status(r.changes ? 200 : 404).json(r.changes ? { ok: true } : { error: 'Message not found.' }); });
  app.delete('/api/admin/contacts/:id', (req, res) => { const r = db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id); res.status(r.changes ? 200 : 404).json(r.changes ? { ok: true } : { error: 'Message not found.' }); });
  const upload = multer({ dest: join(config.mediaPath, '.incoming'), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
  app.post('/api/admin/media', upload.single('file'), async (req, res) => {
    if (!req.file) { res.status(400).json({ error: 'Choose a file.' }); return; }
    try {
      const type = await fileTypeFromFile(req.file.path);
      if (!type || !['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'].includes(type.mime)) { res.status(400).json({ error: 'Upload JPEG, PNG, GIF, WebP, MP4, or WebM.' }); return; }
      if (type.mime.startsWith('image/') && req.file.size > 10 * 1024 * 1024) { res.status(400).json({ error: 'Images must be 10 MB or smaller.' }); return; }
      const id = randomUUID(), filename = `${id}.${type.ext}`;
      renameSync(req.file.path, join(config.mediaPath, filename));
      try { db.prepare('INSERT INTO media VALUES (?,?,?,?,?,?)').run(id, filename, req.file.originalname.slice(0, 200), type.mime, req.file.size, new Date().toISOString()); }
      catch (err) { unlinkSync(join(config.mediaPath, filename)); throw err; }
      res.status(201).json({ id, url: `/media/${id}`, mime: type.mime, name: req.file.originalname });
    } finally { if (existsSync(req.file.path)) unlinkSync(req.file.path); }
  });
  app.get('/media/:id', (req, res) => {
    const id = req.params.id;
    const media = db.prepare('SELECT * FROM media WHERE id=?').get(id) as { filename: string; mime: string } | undefined;
    const published = db.prepare('SELECT 1 FROM entry_media em JOIN entries e ON e.id=em.entry_id WHERE em.media_id=? AND e.published=1 LIMIT 1').get(id);
    if (!media || (!authValid(req) && !published)) { res.status(404).send('Not found'); return; }
    res.set('Cache-Control', 'private, no-store').type(media.mime).sendFile(join(config.mediaPath, media.filename));
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use('/admin', (req, res, next) => {
    if (req.path === '/setup') { if (hasAdmin()) { res.redirect('/admin/login'); return; } next(); return; }
    if (req.path === '/login') { next(); return; }
    if (!hasAdmin()) { res.redirect('/admin/setup'); return; }
    if (!authValid(req)) { res.redirect('/admin/login'); return; } next();
  });
  const client = resolve('dist/client');
  app.use(express.static(client, { index: false }));
  app.get(['/', '/admin', '/admin/{*path}'], (_req, res) => { if (existsSync(join(client, 'index.html'))) res.sendFile(join(client, 'index.html')); else res.type('html').send('<p>Development frontend: <a href="http://localhost:5173">localhost:5173</a></p>'); });
  app.use((_req, res) => res.status(404).send('Not found'));
  app.use((error: Error & { code?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n') }); return; }
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') { res.status(409).json({ error: 'That filename is already in use.' }); return; }
    if (error instanceof multer.MulterError) { res.status(400).json({ error: 'Upload one file, up to 50 MB.' }); return; }
    if (error.status && error.status < 500) { res.status(error.status).json({ error: 'Invalid request.' }); return; }
    console.error('Request failed:', error.message); res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return { app, db };
}
