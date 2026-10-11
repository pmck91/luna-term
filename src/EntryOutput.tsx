import { memo } from 'react';
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Entry } from '../shared/models';
export function safeMediaUrl(url: string) { return /^\/media\/(?:pictures\/)?[a-f0-9-]{36}$/.test(url) || /^https:\/\//.test(url) ? url : ''; }
export function TerminalImage({ src, alt, onLoad }: { src: string; alt: string; onLoad?: () => void }) {
  return safeMediaUrl(src) ? <img src={src} alt={alt || ''} loading="lazy" onLoad={onLoad} /> : <span>[image unavailable]</span>;
}
const components: Components = {
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    input: ({ checked }) => <span>{checked ? '[x]' : '[ ]'}</span>,
    img: ({ src, alt }) => typeof src === 'string' ? <TerminalImage src={src} alt={alt || ''} /> : <span>[image unavailable]</span>,
    pre: ({ children }) => <div className="code-block">{children}</div>,
    code: ({ className, children }) => {
      if (className === 'language-video') {
        const [url, ...caption] = String(children).trim().split('\n');
        return safeMediaUrl(url.trim()) ? <figure><video src={url.trim()} controls tabIndex={0} preload="metadata" playsInline aria-label={caption.join(' ') || 'Video'} />{caption.length > 0 && <figcaption>{caption.join(' ')}</figcaption>}</figure> : <span>[video URL unavailable]</span>;
      }
      return <code className={className}>{children}</code>;
    },
};
export const EntryOutput = memo(function EntryOutput({ entry }: { entry: Entry }) {
  return <article className="entry-output" aria-label={entry.title}><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={defaultUrlTransform} components={components}>{entry.markdown}</ReactMarkdown></article>;
});
