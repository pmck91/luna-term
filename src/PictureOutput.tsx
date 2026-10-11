import type { Picture } from '../shared/models';
import { TerminalImage } from './EntryOutput';

export function PictureOutput({ picture, path, onLoad }: { picture: Picture; path: string; onLoad?: () => void }) {
  return <div className="entry-output picture-output"><div className="dim">~{path}</div><figure><TerminalImage src={picture.url} alt={picture.name} onLoad={onLoad} /><figcaption>{picture.name}</figcaption></figure></div>;
}
