import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntryOutput, safeMediaUrl } from '../src/EntryOutput';
import { CAT } from '../src/logo';
import type { Entry } from '../shared/models';
const render = (markdown: string) => renderToStaticMarkup(<EntryOutput entry={{ id: '1', kind: 'project', slug: 'test', title: 'Test', markdown, published: true, createdAt: '', updatedAt: '' } as Entry} />);
describe('terminal entry rendering', () => {
  it('renders headings, lists, links, and code without cards', () => { const html = render('# Heading\n\n- Item\n\n[Link](https://example.com) and `code`'); expect(html).toContain('<h1>Heading</h1>'); expect(html).toContain('<li>Item</li>'); expect(html).toContain('rel="noopener noreferrer"'); expect(html).toContain('<code'); expect(html).not.toContain('card'); });
  it('drops raw HTML and unsafe links', () => { const html = render('<script>alert(1)</script>\n\n[x](javascript:alert)\n\n<img src=x onerror=alert(1)>'); expect(html).not.toContain('<script'); expect(html).not.toContain('javascript:'); expect(html).not.toContain('onerror'); });
  it('renders image and keyboard-accessible video inline', () => { const url = '/media/12345678-1234-1234-1234-123456789abc'; const html = render(`![Cat](${url})\n\n\`\`\`video\n${url}\nCat video\n\`\`\``); expect(html).toContain('alt="Cat"'); expect(html).toContain('<video'); expect(html).toContain('controls=""'); expect(html).toContain('<figcaption>Cat video</figcaption>'); expect(html).not.toContain('autoplay'); });
  it('rejects unsafe video and image sources', () => { expect(safeMediaUrl('javascript:alert(1)')).toBe(''); expect(safeMediaUrl('//untrusted.example/video')).toBe(''); expect(render('```video\njavascript:alert(1)\n```')).not.toContain('<video'); });
  it('preserves the supplied cat characters and dimensions', () => { expect(CAT.split('\n')).toHaveLength(14); expect(CAT.split('\n')[0]).toBe('       \\`*-.'); expect(CAT.split('\n')[13]).toBe("      `*-*   `*-*  `*-*'"); expect(Math.max(...CAT.split('\n').map(s => s.length))).toBeLessThanOrEqual(32); });
});
