import type { Express } from 'express';
import type Database from 'better-sqlite3';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';
import { randomUUID } from 'node:crypto';
import { existsSync, renameSync, unlinkSync } from 'node:fs';
import { extname, join } from 'node:path';
import { albumSchema, pictureSchema, type Picture, type PictureAlbum, type Pictures } from '../shared/models';
import { pictureFilename } from '../shared/pictures';

function mapPicture(row: Record<string, unknown>): Picture {
  return { id: row.id as string, name: row.name as string, filename: row.filename as string, albumId: row.album_id as string | null, url: `/media/pictures/${row.id}`, createdAt: row.created_at as string, updatedAt: row.updated_at as string };
}
export function readPictures(db: Database.Database): Pictures {
  const albums = (db.prepare('SELECT * FROM picture_albums ORDER BY name, id').all() as Record<string, unknown>[]).map(row => ({ id: row.id as string, name: row.name as string, parentId: row.parent_id as string | null, createdAt: row.created_at as string }));
  const pictures = (db.prepare('SELECT * FROM pictures ORDER BY filename, id').all() as Record<string, unknown>[]).map(mapPicture);
  return { albums, pictures };
}

// Mount after the shared /api/admin authentication, origin and CSRF middleware.
export function pictureRoutes(app: Express, db: Database.Database, mediaPath: string) {
  function albumError(name: string, parentId: string | null, id?: string): string | null {
    if (parentId === null && name === 'view') return 'The name view is reserved for the picture viewer.';
    const seen = new Set(id ? [id] : []);
    let ancestor = parentId;
    while (ancestor !== null) {
      if (seen.has(ancestor)) return 'An album cannot be placed inside itself or its subdirectories.';
      seen.add(ancestor);
      const parent = db.prepare('SELECT parent_id FROM picture_albums WHERE id=?').get(ancestor) as { parent_id: string | null } | undefined;
      if (!parent) return 'Parent album not found.';
      ancestor = parent.parent_id;
    }
    return null;
  }
  const albumExists = (id: string | null) => id === null || !!db.prepare('SELECT 1 FROM picture_albums WHERE id=?').get(id);
  app.get('/api/admin/pictures', (_req, res) => res.json(readPictures(db)));
  app.post('/api/admin/picture-albums', (req, res) => {
    const body = albumSchema.parse(req.body), error = albumError(body.name, body.parentId);
    if (error) { res.status(400).json({ error }); return; }
    const id = randomUUID(), createdAt = new Date().toISOString();
    db.prepare('INSERT INTO picture_albums VALUES (?,?,?,?)').run(id, body.name, body.parentId, createdAt);
    res.status(201).json({ id, ...body, createdAt } satisfies PictureAlbum);
  });
  app.put('/api/admin/picture-albums/:id', (req, res) => {
    const body = albumSchema.parse(req.body), id = req.params.id as string;
    if (!db.prepare('SELECT 1 FROM picture_albums WHERE id=?').get(id)) { res.status(404).json({ error: 'Album not found.' }); return; }
    const error = albumError(body.name, body.parentId, id);
    if (error) { res.status(400).json({ error }); return; }
    db.prepare('UPDATE picture_albums SET name=?, parent_id=? WHERE id=?').run(body.name, body.parentId, id);
    res.json(readPictures(db).albums.find(album => album.id === id));
  });
  app.delete('/api/admin/picture-albums/:id', (req, res) => {
    const id = req.params.id;
    if (!db.prepare('SELECT 1 FROM picture_albums WHERE id=?').get(id)) { res.status(404).json({ error: 'Album not found.' }); return; }
    if (db.prepare('SELECT 1 FROM pictures WHERE album_id=? UNION ALL SELECT 1 FROM picture_albums WHERE parent_id=? LIMIT 1').get(id, id)) { res.status(409).json({ error: 'Move or delete the pictures and subdirectories first. Only empty albums can be deleted.' }); return; }
    db.prepare('DELETE FROM picture_albums WHERE id=?').run(id); res.json({ ok: true });
  });
  const upload = multer({ dest: join(mediaPath, '.incoming'), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2, fieldSize: 1024 } });
  app.post('/api/admin/pictures', upload.single('file'), async (req, res) => {
    if (!req.file) { res.status(400).json({ error: 'Choose a picture.' }); return; }
    try {
      const body = pictureSchema.parse({ ...req.body, albumId: req.body.albumId || null });
      if (!albumExists(body.albumId)) { res.status(400).json({ error: 'Album not found.' }); return; }
      const type = await fileTypeFromFile(req.file.path);
      if (!type || !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type.mime)) { res.status(400).json({ error: 'Upload a JPEG, PNG, GIF, or WebP image.' }); return; }
      const originalExt = extname(req.file.originalname).slice(1).toLowerCase();
      const extension = type.mime === 'image/jpeg' && ['jpg', 'jpeg'].includes(originalExt) ? originalExt : type.ext;
      const filename = pictureFilename(body.name, extension), id = randomUUID(), storageName = `picture-${id}.${extension}`, now = new Date().toISOString();
      renameSync(req.file.path, join(mediaPath, storageName));
      try { db.prepare('INSERT INTO pictures VALUES (?,?,?,?,?,?,?,?,?)').run(id, body.name, filename, storageName, body.albumId, type.mime, req.file.size, now, now); }
      catch (error) { unlinkSync(join(mediaPath, storageName)); throw error; }
      res.status(201).json(mapPicture(db.prepare('SELECT * FROM pictures WHERE id=?').get(id) as Record<string, unknown>));
    } finally { if (existsSync(req.file.path)) unlinkSync(req.file.path); }
  });
  app.put('/api/admin/pictures/:id', (req, res) => {
    const body = pictureSchema.parse(req.body), id = req.params.id as string;
    const picture = db.prepare('SELECT * FROM pictures WHERE id=?').get(id) as Record<string, unknown> | undefined;
    if (!picture) { res.status(404).json({ error: 'Picture not found.' }); return; }
    if (!albumExists(body.albumId)) { res.status(400).json({ error: 'Album not found.' }); return; }
    const extension = extname(picture.filename as string).slice(1);
    db.prepare('UPDATE pictures SET name=?, filename=?, album_id=?, updated_at=? WHERE id=?').run(body.name, pictureFilename(body.name, extension), body.albumId, new Date().toISOString(), id);
    res.json(mapPicture(db.prepare('SELECT * FROM pictures WHERE id=?').get(id) as Record<string, unknown>));
  });
  app.delete('/api/admin/pictures/:id', (req, res) => {
    const picture = db.prepare('SELECT storage_name FROM pictures WHERE id=?').get(req.params.id) as { storage_name: string } | undefined;
    if (!picture) { res.status(404).json({ error: 'Picture not found.' }); return; }
    const path = join(mediaPath, picture.storage_name);
    if (existsSync(path)) unlinkSync(path);
    db.prepare('DELETE FROM pictures WHERE id=?').run(req.params.id); res.json({ ok: true });
  });
  app.get('/media/pictures/:id', (req, res) => {
    const picture = db.prepare('SELECT storage_name, mime FROM pictures WHERE id=?').get(req.params.id) as { storage_name: string; mime: string } | undefined;
    if (!picture) { res.status(404).send('Not found'); return; }
    res.set('Cache-Control', 'no-store').type(picture.mime).sendFile(join(mediaPath, picture.storage_name));
  });
}
