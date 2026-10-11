import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdventureOutput } from '../src/AdventureOutput';
import { createAdventure, describeRoom, adventureInput } from '../shared/adventure';
describe('adventure output rendering', () => {
  it('renders room text and map as selectable terminal output', () => {
    const state = createAdventure(), html = renderToStaticMarkup(<AdventureOutput lines={[...describeRoom(state), ...adventureInput(state, 'map').output]} />);
    expect(html).toContain('Downstairs hallway'); expect(html).toContain('adventure-heading'); expect(html).toContain('<pre'); expect(html).toContain('Map of Peter&#x27;s house');
    expect(html).not.toMatch(/<(?:button|canvas|svg|input|nav|aside)\b/);
  });
  it('escapes untrusted input rather than rendering HTML', () => {
    const html = renderToStaticMarkup(<AdventureOutput lines={adventureInput(createAdventure(), '<script>alert(1)</script>').output} />);
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>');
  });
});
