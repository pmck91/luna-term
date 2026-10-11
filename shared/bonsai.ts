export type BonsaiOptions = { seed?: number; screensaver: boolean };
export const bonsaiAttribution = 'Inspired by cbonsai by John Allbritten: https://gitlab.com/jallbrit/cbonsai\nGitHub fork by jakobrees: https://github.com/jakobrees/cbonsai';
export type TreeTone = 'wood' | 'wood-light' | 'leaf' | 'leaf-light' | 'pot';
export type TreeCell = { char: string; tone: TreeTone };
export type TreeStroke = TreeCell & { x: number; y: number };
export type BonsaiTree = { seed: number; strokes: readonly TreeStroke[] };
export type BonsaiSnapshot = { tree: BonsaiTree; revealed: number; columns: number; rows: number };
const WIDTH = 77, HEIGHT = 24;

// A browser-native generator. Drawing order follows each branch as it grows.
export function generateBonsai(seed: number): BonsaiTree {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  const strokes: TreeStroke[] = [];
  const draw = (x: number, y: number, char: string, tone: TreeTone) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) strokes.push({ x, y, char, tone });
  };
  function leaves(x: number, y: number) {
    const rx = 5 + random() * 4, ry = 1.8 + random() * 1.5;
    const points: { x: number; y: number; distance: number }[] = [];
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const distance = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (distance < 1 && random() > 0.16) points.push({ x: x + dx, y: y + dy, distance });
    }
    points.sort((a, b) => a.distance - b.distance);
    for (const p of points) draw(p.x, p.y, random() > 0.8 ? '*' : '&', random() > 0.65 ? 'leaf-light' : 'leaf');
  }
  function branch(x: number, y: number, length: number, angle: number, thickness: number, depth: number) {
    for (let i = 0; i < length; i++) {
      angle = Math.max(-1.35, Math.min(1.35, angle + (random() - 0.5) * 0.17));
      const previousX = x, previousY = y;
      x += Math.sin(angle) * 1.9; y -= Math.cos(angle) * 0.85;
      const char = angle > 0.25 ? '/' : angle < -0.25 ? '\\' : '|';
      const spread = Math.max(1, Math.round(thickness * (1 - i / length * 0.45)));
      const steps = Math.ceil(Math.max(Math.abs(x - previousX), Math.abs(y - previousY)));
      for (let step = 1; step <= steps; step++) for (let w = 0; w < spread; w++) draw(previousX + (x - previousX) * step / steps + w - (spread - 1) / 2, previousY + (y - previousY) * step / steps, char, w === 0 ? 'wood' : 'wood-light');
      if (y < 3) break;
    }
    if (!depth || y < 4) { leaves(x, y); return; }
    const lean = (random() - 0.5) * 0.28;
    branch(x, y, length * (0.62 + random() * 0.16), angle - 0.5 + lean, Math.max(1, thickness - 1), depth - 1);
    branch(x, y, length * (0.62 + random() * 0.16), angle + 0.5 + lean, Math.max(1, thickness - 1), depth - 1);
  }
  let x = 38, y = 23;
  for (let w = 0; w < 4; w++) draw(x + w - 1, y, w === 0 ? '/' : w === 3 ? '\\' : '|', w === 0 ? 'wood' : 'wood-light');
  const lean = (random() - 0.5) * 0.5;
  const trunk: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    x += Math.sin(i * 0.42 + lean) * 0.8 + lean; y -= 0.85;
    trunk.push([x, y]);
    for (let w = 0; w < Math.max(2, 4 - Math.floor(i / 4)); w++) draw(x + w - 1, y, w === 0 ? '/' : w === 3 ? '\\' : '|', w === 0 ? 'wood' : 'wood-light');
  }
  const low = trunk[5];
  branch(low[0], low[1], 6, -1.0, 2, 2);
  branch(x, y, 6.5, -0.55 + lean, 2, 3);
  branch(x, y, 7.5, 0.65 + lean, 2, 3);
  return { seed: seed >>> 0, strokes };
}

export function treeDimensions(columns: number, rows: number) {
  return { columns: Math.max(23, Math.min(79, Math.floor(columns))), rows: Math.max(9, Math.min(28, Math.floor(rows))) };
}
export function renderBonsai({ tree, revealed, columns, rows }: BonsaiSnapshot): (TreeCell | null)[][] {
  const dimensions = treeDimensions(columns, rows); columns = dimensions.columns; rows = dimensions.rows;
  const grid = Array.from({ length: rows }, () => Array<TreeCell | null>(columns).fill(null));
  for (const stroke of tree.strokes.slice(0, Math.max(0, Math.floor(revealed)))) {
    const x = Math.round(stroke.x / (WIDTH - 1) * (columns - 1));
    const y = Math.round(stroke.y / (HEIGHT - 1) * (rows - 5));
    const previous = grid[y][x];
    if (stroke.tone.startsWith('leaf') && previous?.tone.startsWith('wood')) continue;
    grid[y][x] = { char: stroke.char, tone: stroke.tone };
  }
  const pot = ['_____________________', '\\                   /', ' \\_________________/ ', '    (_)       (_)    '];
  for (let r = 0; r < pot.length; r++) for (let c = 0; c < pot[r].length; c++) {
    const x = Math.floor((columns - pot[r].length) / 2) + c;
    if (pot[r][c] !== ' ') grid[rows - 4 + r][x] = { char: pot[r][c], tone: 'pot' };
  }
  return grid;
}

export function treeText(snapshot: BonsaiSnapshot): string {
  return renderBonsai(snapshot).map(row => row.map(cell => cell?.char ?? ' ').join('')).join('\n');
}
