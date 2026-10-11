import type Database from 'better-sqlite3';
import * as argon2 from 'argon2';
export async function resetAdminPassword(db: Database.Database, password: string) {
  if (password.length < 12 || password.length > 256) throw new Error('Password must contain 12 to 256 characters.');
  if (!db.prepare('SELECT 1 FROM admins WHERE id=1').get()) throw new Error('No account exists. Use /admin/setup.');
  const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  db.transaction(() => { db.prepare('UPDATE admins SET password_hash=? WHERE id=1').run(hash); db.prepare('DELETE FROM sessions').run(); })();
}
