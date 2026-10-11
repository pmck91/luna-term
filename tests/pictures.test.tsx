import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { albumSchema, pictureSchema, type Catalog, type Picture } from '../shared/models';
import { albumPaths, pictureFilename, picturePath } from '../shared/pictures';
import { complete, execute } from '../shared/shell';
import { PictureOutput } from '../src/PictureOutput';

const album = { id: '11111111-1111-4111-8111-111111111111', name: 'holidays', parentId: null, createdAt: '' };
const child = { ...album, id: '22222222-2222-4222-8222-222222222222', name: 'ireland', parentId: album.id };
const picture: Picture = { id: '33333333-3333-4333-8333-333333333333', name: 'Luna at the window', filename: 'luna-at-the-window.jpeg', albumId: null, url: '/media/pictures/33333333-3333-4333-8333-333333333333', createdAt: '', updatedAt: '' };
const nested = { ...picture, id: '44444444-4444-4444-8444-444444444444', name: 'Coast', filename: 'coast.png', albumId: child.id };
const catalog: Catalog = { entries: [], socials: [], repositoryUrl: null, albums: [child, album], pictures: [nested, picture] };
describe('picture names and album paths', () => {
  it('builds nested paths independent of album ordering and skips broken/cyclic chains', () => {
    expect(albumPaths(catalog.albums).get(child.id)).toBe('/pictures/holidays/ireland');
    expect(picturePath(nested, catalog.albums)).toBe('/pictures/holidays/ireland/coast.png');
    expect(picturePath(picture, [])).toBe('/pictures/luna-at-the-window.jpeg');
    expect(albumPaths([{ ...album, parentId: child.id }, child]).size).toBe(0);
    expect(picturePath(nested, [child])).toBeNull();
  });
  it('makes safe virtual filenames while retaining a real image extension', () => {
    expect(pictureFilename('Luna at the window', 'jpeg')).toBe('luna-at-the-window.jpeg');
    expect(pictureFilename('Café.PNG', 'png')).toBe('cafe.png');
    expect(pictureFilename('../../cat', 'jpg')).toBe('cat.jpg');
    expect(pictureFilename('🐈', 'webp')).toBe('picture.webp');
    expect(pictureFilename('x'.repeat(160), 'gif')).toHaveLength(84);
    expect(pictureSchema.safeParse({ name: ' ', albumId: null }).success).toBe(false);
    for (const name of ['../escape', 'a/b', 'Cat pics', '.', '']) expect(albumSchema.safeParse({ name, parentId: null }).success).toBe(false);
  });
});
describe('read-only virtual pictures', () => {
  it('lists root pictures, nested albums and the viewer using normal directory commands', () => {
    expect(execute('ls pictures', '/', catalog).output[0]).toMatchObject({ text: 'holidays/  luna-at-the-window.jpeg  view' });
    expect(execute('cd ~/pictures/holidays/ireland', '/', catalog).cwd).toBe('/pictures/holidays/ireland');
    expect(execute('ls', '/pictures/holidays/ireland', catalog).output[0]).toMatchObject({ text: 'coast.png' });
    expect(execute('cat ~/pictures/view', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('view [file|album]') });
  });
  it('views individual files through absolute, relative, and normalized paths', () => {
    for (const command of ['view ./coast.png', '~/pictures/view ../../holidays/ireland/coast.png']) {
      expect(execute(command, '/pictures/holidays/ireland', catalog).output).toEqual([{ type: 'picture', picture: nested, path: '/pictures/holidays/ireland/coast.png' }]);
    }
    expect(execute('view ~/pictures/luna-at-the-window.jpeg', '/', catalog).output[0]).toMatchObject({ type: 'picture', picture });
    expect(execute('cat ~/pictures/luna-at-the-window.jpeg', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('Use view') });
  });
  it('views immediate album pictures, defaults to the current album, and explains empty albums', () => {
    expect(execute('view', '/pictures', catalog).output).toHaveLength(2);
    expect(execute('view', '/pictures/holidays/ireland', catalog).output[1]).toMatchObject({ type: 'picture', picture: nested });
    expect(execute('view ~/pictures/holidays', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('No pictures') });
    expect(execute('./view', '/pictures', catalog).output[1]).toMatchObject({ type: 'picture', picture });
    expect(execute('help', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('Luna picture viewer') });
  });
  it('requires an explicit picture path outside albums, even after previously viewing pictures', () => {
    expect(execute('view', '/pictures', catalog).output[1]).toMatchObject({ type: 'picture', picture });
    for (const cwd of ['/', '/messaging', '/games', '/projects', '/documents']) {
      for (const command of ['view', '~/pictures/view']) {
        const result = execute(command, cwd, catalog);
        expect(result.output).toEqual([{ type: 'text', tone: 'error', text: expect.stringContaining('Use view ~/pictures') }]);
      }
      expect(execute('view ~/pictures', cwd, catalog).output[1]).toMatchObject({ type: 'picture', picture });
    }
  });
  it('completes viewer commands, files and nested directory paths', () => {
    expect(complete('vi', '/', catalog).input).toBe('view ');
    expect(complete('view ~/pictures/hol', '/', catalog).input).toBe('view ~/pictures/holidays/');
    expect(complete('view co', '/pictures/holidays/ireland', catalog).input).toBe('view coast.png ');
    expect(complete('~/pictures/view ~/pictures/luna', '/', catalog).input).toBe('~/pictures/view ~/pictures/luna-at-the-window.jpeg ');
    expect(complete('cd ~/pictures/lu', '/', catalog).candidates).toEqual([]);
    expect(complete('view ~/games/', '/', catalog).candidates).toEqual([]);
  });
  it('rejects writes, missing files, unsupported content and incomplete input', () => {
    for (const command of ['mkdir ~/pictures/new', 'rm ~/pictures/luna-at-the-window.jpeg', 'view missing.jpg', 'view ~/projects', 'view ~/pictures/view', 'view a b', 'view "']) expect(execute(command, '/', catalog).output[0]).toMatchObject({ tone: 'error' });
    expect(execute('view --help', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('read-only access') });
  });
});
describe('picture terminal output', () => {
  it('uses the shared inline media styling and escapes names without adding controls', () => {
    const html = renderToStaticMarkup(<PictureOutput picture={{ ...picture, name: '<script>cat</script>' }} path="/pictures/luna.jpeg" />);
    expect(html).toContain('entry-output picture-output'); expect(html).toContain('~/pictures/luna.jpeg'); expect(html).toContain(picture.url);
    expect(html).toContain('alt="&lt;script&gt;cat&lt;/script&gt;"'); expect(html).not.toContain('<script>');
    expect(html).not.toMatch(/<(?:button|canvas|nav|aside)\b/);
  });
});
