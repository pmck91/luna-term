import { describe, it, expect } from 'vitest';
import { complete, execute, parseCommand, resolvePath } from '../shared/shell';
import { entryPath, isTheme, type Catalog, type Entry } from '../shared/models';
const project: Entry = { id: '1', kind: 'project', slug: 'portfolio', title: 'Portfolio', markdown: '# Portfolio\n\nHello.', published: true, createdAt: '', updatedAt: '' };
const blog: Entry = { ...project, id: '2', kind: 'blog', slug: 'notes', title: 'Notes' };
const catalog: Catalog = { entries: [project, blog, { ...project, id: '3', slug: 'private', published: false }], socials: [{ label: 'Example', url: 'https://example.com' }], repositoryUrl: null, pictures: [], albums: [] };
describe('command parsing', () => {
  it('handles whitespace, quotes, escaped spaces, and empty arguments', () => expect(parseCommand(' cat "a b" c\\ d \'\' ')).toEqual(['cat', 'a b', 'c d', '']));
  it('reports incomplete quotes and escapes', () => { expect(() => parseCommand('cat "test')).toThrow('Close'); expect(() => parseCommand('cat test\\')).toThrow('Incomplete'); });
  it('treats OS syntax as inert text', () => { expect(parseCommand('echo $(id); rm -rf /')).toEqual(['echo', '$(id);', 'rm', '-rf', '/']); expect(execute('echo $(id)', '/', catalog).output).toMatchObject([{ tone: 'error' }]); });
});
describe('virtual paths and execution', () => {
  it.each([['~/projects/../documents', '/messaging', '/documents'], ['../../../etc', '/projects', '/etc'], ['./portfolio.luna', '/projects', '/projects/portfolio.luna'], ['~', '/documents', '/'], ['/projects//./', '/', '/projects']])('normalizes %s from %s', (p, cwd, expected) => expect(resolvePath(p, cwd)).toBe(expected));
  it('uses distinct extensions', () => { expect(entryPath(project)).toBe('/projects/portfolio.luna'); expect(entryPath(blog)).toBe('/documents/notes.ldoc'); });
  it('lists real filenames and hides drafts', () => { const r = execute('ls projects', '/', catalog); expect(r.output).toEqual([{ type: 'text', text: 'portfolio.luna', tone: undefined }]); });
  it('changes directories and prints the current path', () => { expect(execute('cd projects', '/', catalog).cwd).toBe('/projects'); expect(execute('pwd', '/projects', catalog).output[0]).toMatchObject({ text: '/projects' }); expect(execute('cd', '/projects', catalog).cwd).toBe('/'); });
  it('runs allowed entries and the contact script', () => { expect(execute('./projects/portfolio.luna', '/', catalog).output).toEqual([{ type: 'entry', entry: project }]); expect(execute('./contact.sh', '/messaging', catalog).action).toBe('contact'); });
  it('reads source and social links', () => { expect(execute('cat ~/projects/portfolio.luna', '/', catalog).output[0]).toMatchObject({ text: project.markdown }); expect(execute('cat socials.txt', '/messaging', catalog).output[0]).toMatchObject({ text: 'Example: https://example.com' }); });
  it.each(['cat', 'cat projects', 'cd projects/portfolio.luna', './messaging/socials.txt', './projects/private.luna', 'ls missing', 'theme nope', 'pwd extra', 'clear extra', 'cat "'])('gives useful errors for %s', cmd => expect(execute(cmd, '/', catalog).output[0]).toMatchObject({ type: 'text', tone: 'error' }));
  it('clears without losing shell state', () => expect(execute('clear', '/projects', catalog)).toEqual({ output: [], action: 'clear' }));
  it('switches only known themes', () => { expect(execute('theme nord', '/', catalog)).toMatchObject({ action: 'theme', theme: 'nord' }); expect(isTheme('nord')).toBe(true); expect(isTheme('custom')).toBe(false); });
});
describe('completion', () => {
  it('completes commands and theme names', () => { expect(complete('he', '/', catalog).input).toBe('help '); expect(complete('theme sol', '/', catalog).input).toBe('theme solarized-dark '); });
  it('completes relative and home paths with directory slashes', () => { expect(complete('cd pro', '/', catalog).input).toBe('cd projects/'); expect(complete('cat ~/messaging/soc', '/', catalog).input).toBe('cat ~/messaging/socials.txt '); expect(complete('./por', '/projects', catalog).input).toBe('./portfolio.luna '); });
  it('lists ambiguous candidates and excludes files for cd', () => { expect(complete('c', '/', catalog).candidates).toEqual(['cd', 'cat', 'clear']); expect(complete('cd ./', '/projects', catalog).candidates).toEqual([]); });
  it('does not complete private entries', () => expect(complete('./projects/pri', '/', catalog).candidates).toEqual([]));
});
describe('game filesystem', () => {
  it('discovers and runs the built-in game through normalized virtual paths', () => {
    expect(execute('ls', '/', catalog).output[0]).toMatchObject({ text: 'documents/  games/  messaging/  pictures/  projects/' });
    expect(execute('cd ~/games', '/', catalog).cwd).toBe('/games');
    expect(execute('ls', '/games', catalog).output[0]).toMatchObject({ text: '2048-readme.txt  2048.game  bonsai-readme.txt  bonsai.game  lunas-adventure-readme.txt  lunas-adventure.game' });
    expect(execute('./2048.game', '/games', catalog)).toEqual({ output: [], action: 'game2048' });
    expect(execute('~/games/../games/2048.game', '/projects', catalog).action).toBe('game2048');
  });
  it('reads instructions and rejects inappropriate game paths and arguments', () => {
    expect(execute('cat ~/games/2048-readme.txt', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('Ctrl+C quits') });
    expect(execute('cat 2048.game', '/games', catalog).output[0]).toMatchObject({ text: expect.stringContaining('Merge equal') });
    for (const command of ['./games/missing.game', './games/2048-readme.txt', './games/2048.game extra', 'cd games/2048.game']) expect(execute(command, '/', catalog).output[0]).toMatchObject({ tone: 'error' });
    expect(execute('help', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('./games/2048.game') });
  });
  it('completes directories, game filenames, and instructions', () => {
    expect(complete('cd ga', '/', catalog).input).toBe('cd games/');
    expect(complete('./games/20', '/', catalog).input).toBe('./games/2048');
    expect(complete('./games/20', '/', catalog).candidates).toEqual(['./games/2048-readme.txt', './games/2048.game']);
    expect(complete('./2048.g', '/games', catalog).input).toBe('./2048.game ');
    expect(complete('cat ~/games/2048-r', '/projects', catalog).input).toBe('cat ~/games/2048-readme.txt ');
    expect(complete('cd ./', '/games', catalog).candidates).toEqual([]);
  });
});
