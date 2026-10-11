import { z } from 'zod';

export type Entry = { id: string; kind: 'project' | 'blog'; slug: string; title: string; markdown: string; published: boolean; createdAt: string; updatedAt: string };
export type Social = { label: string; url: string };
export type Catalog = { entries: Entry[]; socials: Social[]; repositoryUrl: string | null };
export const themes = ['mocha', 'dracula', 'nord', 'solarized-dark'] as const;
export type Theme = typeof themes[number];
export const isTheme = (s: string): s is Theme => themes.includes(s as Theme);
export const entryPath = (entry: Pick<Entry, 'kind' | 'slug'>) => `/${entry.kind === 'project' ? 'projects' : 'documents'}/${entry.slug}.${entry.kind === 'project' ? 'luna' : 'ldoc'}`;
export const entrySchema = z.object({
  kind: z.enum(['project', 'blog']), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens.').max(80),
  title: z.string().trim().min(1).max(160), markdown: z.string().max(100000), published: z.boolean(),
});
export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(100), email: z.email('Enter a valid email address.').max(254),
  subject: z.string().trim().min(1, 'Enter a subject.').max(200), message: z.string().trim().min(1, 'Enter a message.').max(10000),
  submissionId: z.uuid(),
});
export const socialSchema = z.array(z.object({ label: z.string().trim().min(1).max(60), url: z.url().max(2000).refine(s => /^https?:\/\//.test(s), 'Use an HTTP or HTTPS URL.') })).max(20);
export const accountSchema = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(12, 'Use at least 12 characters.').max(256) });
export type Contact = z.infer<typeof contactSchema> & { id: string; createdAt: string; read: boolean };
