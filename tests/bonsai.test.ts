import { describe, expect, it } from 'vitest';
import { generateBonsai, renderBonsai, treeDimensions, treeText } from '../shared/bonsai';
import { complete, execute } from '../shared/shell';
import type { Catalog } from '../shared/models';
const catalog: Catalog = { entries: [], socials: [], repositoryUrl: null, pictures: [], albums: [] };

describe('bonsai generator', () => {
  it('reproduces growth order and shape from a seed', () => {
    expect(generateBonsai(42)).toEqual(generateBonsai(42));
    expect(generateBonsai(42).strokes).not.toEqual(generateBonsai(43).strokes);
  });
  it.each([0, 1, 42, 1000, 4294967295])('keeps tree %s bounded and limits its workload', seed => {
    const tree = generateBonsai(seed);
    expect(tree.strokes.length).toBeGreaterThan(100); expect(tree.strokes.length).toBeLessThan(5000);
    expect(tree.strokes.every(s => Number.isInteger(s.x) && Number.isInteger(s.y) && s.x >= 0 && s.x < 77 && s.y >= 0 && s.y < 24)).toBe(true);
    expect(tree.strokes.every(s => s.char.length === 1 && /^[\x20-\x7e]$/.test(s.char))).toBe(true);
    const tones = new Set(tree.strokes.map(s => s.tone)); expect(tones.has('wood')).toBe(true); expect(tones.has('leaf')).toBe(true);
  });
  it.each([[23, 9], [44, 12], [77, 28]])('renders within %s columns and %s rows with an intact pot', (columns, rows) => {
    const tree = generateBonsai(42), snapshot = { tree, revealed: tree.strokes.length, columns, rows };
    const lines = treeText(snapshot).split('\n');
    expect(lines).toHaveLength(rows); expect(lines.every(line => line.length === columns)).toBe(true);
    expect(lines[rows - 4]).toContain('_____________________'); expect(lines.at(-1)).toContain('(_)');
    const tones = new Set(renderBonsai(snapshot).flat().filter(Boolean).map(cell => cell!.tone));
    expect(tones.has('wood')).toBe(true); expect(tones.has('leaf')).toBe(true); expect(tones.has('pot')).toBe(true);
  });
  it('shows the pot before growth and adds branches incrementally without modifying a tree', () => {
    const tree = generateBonsai(42), initial = structuredClone(tree);
    const base = { tree, columns: 49, rows: 22 };
    const occupied = (revealed: number) => renderBonsai({ ...base, revealed }).flat().filter(Boolean).length;
    expect(occupied(0)).toBeGreaterThan(0); expect(occupied(20)).toBeGreaterThan(occupied(0));
    expect(occupied(tree.strokes.length)).toBeGreaterThan(occupied(20)); expect(tree).toEqual(initial);
    expect(treeText({ ...base, revealed: -1 })).toBe(treeText({ ...base, revealed: 0 }));
  });
  it('caps the canvas size for narrow or very large terminals', () => {
    expect(treeDimensions(3, 2)).toEqual({ columns: 23, rows: 9 });
    expect(treeDimensions(10000, 10000)).toEqual({ columns: 79, rows: 28 });
  });
});
describe('bonsai shell and instructions', () => {
  it('launches using commands or normalized virtual paths with validated options', () => {
    expect(execute('bonsai', '/', catalog)).toMatchObject({ action: 'bonsai', bonsai: { screensaver: false } });
    expect(execute('bonsai --seed 42 --screensaver', '/projects', catalog)).toMatchObject({ action: 'bonsai', bonsai: { seed: 42, screensaver: true } });
    expect(execute('./bonsai.game --seed 0', '/games', catalog)).toMatchObject({ action: 'bonsai', bonsai: { seed: 0 } });
    expect(execute('~/games/../games/bonsai.game --seed 4294967295', '/', catalog)).toMatchObject({ action: 'bonsai', bonsai: { seed: 4294967295 } });
  });
  it.each(['bonsai --seed', 'bonsai --seed -1', 'bonsai --seed 1.5', 'bonsai --seed NaN', 'bonsai --seed 4294967296', 'bonsai --seed 2 --seed 3', 'bonsai --screensaver --screensaver', 'bonsai --unknown', 'bonsai --seed "$(id)"'])('rejects invalid options: %s', command => {
    expect(execute(command, '/', catalog).output[0]).toMatchObject({ tone: 'error' });
  });
  it('offers instructions and uses the renamed 2048 readme', () => {
    expect(execute('bonsai --help', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('Selecting text pauses growth') });
    expect(execute('cat ~/games/bonsai-readme.txt', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('--screensaver') });
    for (const command of ['bonsai --help', 'cat ~/games/bonsai-readme.txt', 'cat ~/games/bonsai.game']) {
      expect(execute(command, '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('cbonsai by John Allbritten: https://gitlab.com/jallbrit/cbonsai') });
    }
    expect(execute('cat ~/games/2048-readme.txt', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('Luna 2048') });
    expect(execute('cat ~/games/readme.txt', '/', catalog).output[0]).toMatchObject({ tone: 'error' });
  });
  it('completes command names, paths, and options', () => {
    expect(complete('bon', '/', catalog).input).toBe('bonsai ');
    expect(complete('bonsai --see', '/', catalog).input).toBe('bonsai --seed ');
    expect(complete('./bonsai.game --scr', '/games', catalog).input).toBe('./bonsai.game --screensaver ');
    expect(complete('cat ~/games/bonsai-r', '/', catalog).input).toBe('cat ~/games/bonsai-readme.txt ');
    expect(complete('./games/bonsai.g', '/', catalog).input).toBe('./games/bonsai.game ');
  });
});
