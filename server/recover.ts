import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';
import { openDatabase } from './db';
import { resetAdminPassword } from './recovery';
if (existsSync('.env')) process.loadEnvFile('.env');
if (!stdin.isTTY) throw new Error('Run recovery in an interactive terminal.');
const db = openDatabase(process.env.DATABASE_PATH || 'data/luna.sqlite');
const admin = db.prepare('SELECT username FROM admins WHERE id=1').get() as { username: string } | undefined;
if (!admin) { db.close(); throw new Error('No account exists. Use /admin/setup.'); }
let muted = false;
const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) stdout.write(chunk); callback(); } });
const rl = createInterface({ input: stdin, output, terminal: true });
try {
  stdout.write(`Reset password for ${admin.username}\nNew password (at least 12 characters): `); muted = true;
  const password = await rl.question(''); stdout.write('\nConfirm password: '); const confirmation = await rl.question(''); stdout.write('\n');
  if (password.length < 12 || password.length > 256 || password !== confirmation) throw new Error('Passwords must match and contain 12 to 256 characters.');
  await resetAdminPassword(db, password);
  stdout.write('Password updated. All admin sessions invalidated.\n');
} finally { rl.close(); db.close(); }
