import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Game2048, readBest, type GameSession } from '../src/Game2048';

const session: GameSession = {
  state: { board: [[2, 4, 8, 16], [32, 64, 128, 256], [512, 1024, 2048, 4096], [0, 0, 0, 0]], score: 100, status: 'playing', continued: false },
  best: 200, message: 'Moved left.', confirmRestart: false,
};
afterEach(() => vi.unstubAllGlobals());
describe('ASCII game rendering', () => {
  it('renders selectable text borders, values, score, and palette colours', () => {
    const html = renderToStaticMarkup(<Game2048 session={session} />);
    expect(html).toContain('+------+------+------+------+'); expect(html).toContain('<pre');
    expect(html).toContain('Score: <span>100</span>');
    for (const value of [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]) expect(html).toContain(`color:var(--tile-${value})`);
    expect(html).not.toMatch(/<(canvas|button|svg)/); expect(html).toContain('role="status"');
  });
  it('sizes columns for larger tile values and omits controls in a finished snapshot', () => {
    const large = { ...session, state: { ...session.state, board: [[131072, 0, 0, 0], ...session.state.board.slice(1)] } };
    const html = renderToStaticMarkup(<Game2048 session={large} finished />);
    expect(html).toContain('--board-columns:37'); expect(html).toContain('+--------+--------+--------+--------+');
    expect(html).toContain('131072'); expect(html).not.toContain('Arrows / WASD');
  });
  it('shows restart, win, and loss instructions', () => {
    expect(renderToStaticMarkup(<Game2048 session={{ ...session, confirmRestart: true }} />)).toContain('Restart? Y: yes / N: keep playing');
    expect(renderToStaticMarkup(<Game2048 session={{ ...session, state: { ...session.state, status: 'won' } }} />)).toContain('C: continue');
    expect(renderToStaticMarkup(<Game2048 session={{ ...session, state: { ...session.state, status: 'over' } }} />)).toContain('No moves left');
  });
});
describe('local personal best', () => {
  it.each(['100', '0', '-1', 'NaN', 'Infinity', '1.5', '9007199254740992'])('validates saved score %s', value => {
    vi.stubGlobal('localStorage', { getItem: () => value });
    expect(readBest()).toBe(value === '100' ? 100 : 0);
  });
  it('works when local storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Storage blocked'); } });
    expect(readBest()).toBe(0);
  });
});
