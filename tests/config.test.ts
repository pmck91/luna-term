import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { configuration } from '../server/config';
beforeEach(() => { vi.stubEnv('SESSION_SECRET', 'session-abcdefghijklmnopqrstuvwxyz123456'); vi.stubEnv('ADMIN_SETUP_TOKEN', 'setup-abcdefghijklmnopqrstuvwxyz12345678'); vi.stubEnv('PUBLIC_ORIGIN', 'http://localhost:5173'); vi.stubEnv('GITHUB_REPOSITORY_URL', ''); vi.stubEnv('NODE_ENV', 'development'); });
afterEach(() => vi.unstubAllEnvs());
it('accepts configured development secrets and an optional source link', () => expect(configuration().repositoryUrl).toBeNull());
it('rejects example secrets and shared secrets', () => { vi.stubEnv('SESSION_SECRET', 'replace-with-at-least-32-random-characters'); expect(configuration).toThrow('SESSION_SECRET'); vi.stubEnv('SESSION_SECRET', process.env.ADMIN_SETUP_TOKEN!); expect(configuration).toThrow('different'); });
it('requires an HTTPS production origin without a trailing slash', () => { vi.stubEnv('NODE_ENV', 'production'); expect(configuration).toThrow('HTTPS'); vi.stubEnv('PUBLIC_ORIGIN', 'https://term.pmck.ie/'); expect(configuration).toThrow('origin'); vi.stubEnv('PUBLIC_ORIGIN', 'https://term.pmck.ie'); expect(configuration().production).toBe(true); });
