import { resolve } from 'node:path';
export type Config = { port: number; databasePath: string; mediaPath: string; origin: string; sessionSecret: string; setupToken: string; repositoryUrl: string | null; production: boolean; trustProxy: string[]; contactLimit: number };
export function configuration(): Config {
  const production = process.env.NODE_ENV === 'production';
  const origin = process.env.PUBLIC_ORIGIN || 'http://localhost:5173';
  const sessionSecret = process.env.SESSION_SECRET || '';
  const setupToken = process.env.ADMIN_SETUP_TOKEN || '';
  if (sessionSecret.length < 32 || sessionSecret.startsWith('replace-')) throw new Error('Set SESSION_SECRET to at least 32 random characters.');
  if (setupToken.length < 32 || setupToken.startsWith('replace-')) throw new Error('Set ADMIN_SETUP_TOKEN to at least 32 random characters.');
  if (sessionSecret === setupToken) throw new Error('SESSION_SECRET and ADMIN_SETUP_TOKEN must be different.');
  const url = new URL(origin);
  if (url.origin !== origin || (production && url.protocol !== 'https:')) throw new Error('PUBLIC_ORIGIN must be an origin without a trailing slash and use HTTPS in production.');
  const repositoryUrl = process.env.GITHUB_REPOSITORY_URL || null;
  if (repositoryUrl && new URL(repositoryUrl).protocol !== 'https:') throw new Error('GITHUB_REPOSITORY_URL must use HTTPS.');
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  return { port, production, origin, sessionSecret, setupToken, repositoryUrl, databasePath: resolve(process.env.DATABASE_PATH || 'data/luna.sqlite'), mediaPath: resolve(process.env.MEDIA_PATH || 'uploads'), trustProxy: (process.env.TRUST_PROXY || '').split(',').map(s => s.trim()).filter(Boolean), contactLimit: 5 };
}
