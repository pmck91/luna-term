import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BonsaiOutput } from '../src/Bonsai';
import { generateBonsai } from '../shared/bonsai';
describe('bonsai output', () => {
  it('renders a selectable text tree with distinct wood, foliage, and pot tones', () => {
    const tree = generateBonsai(42);
    const html = renderToStaticMarkup(<BonsaiOutput snapshot={{ tree, revealed: tree.strokes.length, columns: 49, rows: 22 }} />);
    expect(html).toContain('<pre'); expect(html).toContain('seed 42'); expect(html).toContain('bonsai-wood');
    expect(html).toContain('bonsai-leaf'); expect(html).toContain('bonsai-pot');
    expect(html).toContain('aria-live="off"'); expect(html).not.toMatch(/<(canvas|svg|button|img)[ >]/);
  });
});
