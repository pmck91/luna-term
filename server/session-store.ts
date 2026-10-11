import session from 'express-session';
import type Database from 'better-sqlite3';
export class SqliteSessionStore extends session.Store {
  constructor(private db: Database.Database) { super(); }
  get(sid: string, cb: (err: unknown, session?: session.SessionData | null) => void) {
    try {
      const row = this.db.prepare('SELECT data FROM sessions WHERE sid = ? AND expires > ?').get(sid, Date.now()) as { data: string } | undefined;
      cb(null, row ? JSON.parse(row.data) : null);
    } catch (e) { cb(e); }
  }
  set(sid: string, value: session.SessionData, cb?: (err?: unknown) => void) {
    try {
      const expires = value.cookie.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 8 * 3600000;
      this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET data=excluded.data, expires=excluded.expires').run(sid, JSON.stringify(value), expires);
      this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now()); cb?.();
    } catch (e) { cb?.(e); }
  }
  destroy(sid: string, cb?: (err?: unknown) => void) { try { this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); cb?.(); } catch (e) { cb?.(e); } }
  touch(sid: string, value: session.SessionData, cb?: (err?: unknown) => void) { this.set(sid, value, cb); }
}
