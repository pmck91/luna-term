import type { Picture, PictureAlbum } from './models';

export const pictureInstructions = `Luna picture viewer

view [file|album]       Display a picture or the pictures in an album
~/pictures/view [path]  Run the viewer by its virtual path

Examples:
  cd ~/pictures
  ls
  view luna.jpg
  view holidays
  view ~/pictures

Without a path, view shows the current picture album.
From other directories, pass a path, such as view ~/pictures.
Albums show their immediate pictures. Use ls and cd to explore subdirectories.
Tab completes picture and album paths. Images appear inside terminal output.
Pictures and albums are managed by the admin. Visitors have read-only access.`;

export function albumPaths(albums: PictureAlbum[]): Map<string, string> {
  const definitions = new Map(albums.map(album => [album.id, album]));
  const paths = new Map<string, string>();
  for (const album of albums) {
    const names: string[] = [], seen = new Set<string>();
    let current: PictureAlbum | undefined = album;
    while (current) {
      if (seen.has(current.id)) break;
      seen.add(current.id); names.unshift(current.name);
      if (current.parentId === null) { paths.set(album.id, '/pictures/' + names.join('/')); break; }
      current = definitions.get(current.parentId);
    }
  }
  return paths;
}

export function picturePath(picture: Picture, albums: PictureAlbum[]): string | null {
  const parent = picture.albumId === null ? '/pictures' : albumPaths(albums).get(picture.albumId);
  return parent ? `${parent}/${picture.filename}` : null;
}

export function pictureFilename(name: string, extension: string): string {
  const stem = name.replace(/\.(?:jpe?g|png|gif|webp)$/i, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80).replace(/^-|-$/g, '') || 'picture';
  return `${stem}.${extension}`;
}
