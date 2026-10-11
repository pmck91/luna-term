import Database from 'better-sqlite3';
import { fileTypeFromFile } from 'file-type';
import { existsSync, readFileSync, statSync, mkdirSync, copyFileSync, unlinkSync, constants } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

if (existsSync('.env')) process.loadEnvFile('.env');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--publish')) throw new Error('Usage: npm run example:night-watch [-- --publish]');
const publish = args.includes('--publish');
const source = resolve(dirname(fileURLToPath(import.meta.url)), '../examples/night-watch');
const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
const database = resolve(process.env.DATABASE_PATH || 'data/luna.sqlite');
const uploads = resolve(process.env.MEDIA_PATH || 'uploads');
if (!existsSync(database)) throw new Error('Start Luna once to initialize the database, then run this import again.');
const db = new Database(database, { fileMustExist: true });
const copied = [];
db.pragma('foreign_keys = ON'); db.pragma('busy_timeout = 5000');
try {
  const existing = db.prepare('SELECT published FROM entries WHERE kind=? AND slug=?').get(manifest.kind, manifest.slug);
  if (existing) {
    console.log(`Night Watch already exists as a ${existing.published ? 'published entry' : 'draft'}. Existing content was preserved.`);
  } else {
    const markdown = readFileSync(join(source, manifest.markdown), 'utf8');
    const media = [];
    for (const asset of manifest.media) {
      const path = join(source, asset.file), type = await fileTypeFromFile(path);
      if (type?.mime !== asset.mime) throw new Error(`Unexpected media type: ${asset.file}`);
      if (db.prepare('SELECT 1 FROM media WHERE id=?').get(asset.id)) throw new Error(`Media identifier already in use: ${asset.id}`);
      const filename = `${asset.id}.${type.ext}`;
      if (existsSync(join(uploads, filename))) throw new Error(`Media file already exists: ${filename}`);
      media.push({ ...asset, path, filename, size: statSync(path).size });
    }
    mkdirSync(uploads, { recursive: true });
    // Add files before committing references, so the running app never sees broken media.
    for (const asset of media) { const destination = join(uploads, asset.filename); copyFileSync(asset.path, destination, constants.COPYFILE_EXCL); copied.push(destination); }
    const id = randomUUID(), now = new Date().toISOString();
    db.transaction(() => {
      for (const asset of media) db.prepare('INSERT INTO media VALUES (?,?,?,?,?,?)').run(asset.id, asset.filename, asset.file, asset.mime, asset.size, now);
      db.prepare('INSERT INTO entries VALUES (?,?,?,?,?,?,?,?)').run(id, manifest.kind, manifest.slug, manifest.title, markdown, Number(publish), now, now);
      for (const asset of media) db.prepare('INSERT INTO entry_media VALUES (?,?)').run(id, asset.id);
    })();
    console.log(publish ? 'Published sample: ~/projects/night-watch.luna' : 'Created Night Watch as a draft. Preview or publish it in /admin.');
  }
} catch (error) {
  for (const path of copied) unlinkSync(path);
  throw error;
} finally { db.close(); }
