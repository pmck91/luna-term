import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Entry } from '../shared/models';

export function openDatabase(filename: string) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON'); db.pragma('busy_timeout = 5000');
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);`);
  if (!db.prepare('SELECT 1 FROM migrations WHERE version = 1').get()) db.transaction(() => {
    db.exec(`
      CREATE TABLE admins (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL);
      CREATE TABLE sessions (sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX sessions_expiry ON sessions(expires);
      CREATE TABLE entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('project','blog')), slug TEXT NOT NULL, title TEXT NOT NULL, markdown TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(kind,slug));
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE contacts (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE media (id TEXT PRIMARY KEY, filename TEXT NOT NULL, original_name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE entry_media (entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE, media_id TEXT NOT NULL REFERENCES media(id), PRIMARY KEY(entry_id,media_id));
    `);
    const now = new Date().toISOString(); const insert = db.prepare('INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insert.run(randomUUID(), 'project', 'portfolio', 'Luna terminal portfolio', '# Luna terminal portfolio\n\nAn experimental interactive portfolio developed by Peter McKinney. Luna is named after his cat.\n\n## Explore\n\n- Projects live in `~/projects`.\n- Blog documents live in `~/documents`.\n- Leave a message with `~/messaging/contact.sh`.\n\nType `help` for commands. Everything here runs in a virtual filesystem in your browser.', 1, now, now);
    insert.run(randomUUID(), 'blog', 'first-post', 'First post (draft example)', '# First post\n\nReplace this draft with your first post.\n\n## Writing\n\nAdd Markdown, upload media, and preview the result in the terminal before publishing.', 0, now, now);
    db.prepare('INSERT INTO settings VALUES (?, ?)').run('socials', '[]');
    db.prepare('INSERT INTO migrations VALUES (1)').run();
  })();
  if (!db.prepare('SELECT 1 FROM migrations WHERE version = 2').get()) db.transaction(() => {
    db.exec(`
      CREATE TABLE picture_albums (id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT REFERENCES picture_albums(id) ON DELETE RESTRICT, created_at TEXT NOT NULL);
      CREATE UNIQUE INDEX picture_album_names ON picture_albums(COALESCE(parent_id, ''), name);
      CREATE TABLE pictures (id TEXT PRIMARY KEY, name TEXT NOT NULL, filename TEXT NOT NULL, storage_name TEXT NOT NULL, album_id TEXT REFERENCES picture_albums(id) ON DELETE RESTRICT, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE UNIQUE INDEX picture_filenames ON pictures(COALESCE(album_id, ''), filename);
      INSERT INTO migrations VALUES (2);
    `);
  })();
  return db;
}
export function mapEntry(row: Record<string, unknown>): Entry {
  return { id: row.id as string, kind: row.kind as Entry['kind'], slug: row.slug as string, title: row.title as string, markdown: row.markdown as string, published: !!row.published, createdAt: row.created_at as string, updatedAt: row.updated_at as string };
}
export function syncMedia(db: Database.Database, entryId: string, markdown: string) {
  db.prepare('DELETE FROM entry_media WHERE entry_id = ?').run(entryId);
  for (const id of new Set([...markdown.matchAll(/\/media\/([a-f0-9-]{36})(?![a-f0-9-])/g)].map(m => m[1]))) {
    if (db.prepare('SELECT 1 FROM media WHERE id = ?').get(id)) db.prepare('INSERT INTO entry_media VALUES (?, ?)').run(entryId, id);
  }
}
