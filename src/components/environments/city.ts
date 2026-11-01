import { z } from 'zod';
import type { ComponentSpec, EnvironmentGenerator, LayerSpec } from '../../core/environment.ts';
import type { Rng } from '../../core/random.ts';

// A rainy night street, after the motel and streetlight scenes of legacy/render.py
// (coordinates are the reference's ×2: it draws at 135×240). Banded sky, two rows
// of buildings with lit windows, a flickering neon sign with a stepped glow, a
// street lamp's cone and pool, reflections on the wet ground, and rain.
// The rng lays out the buildings; each component then draws from its own stream.

/** A constant level or a scene signal "@name" (checked by the loader). */
const level = z.union([z.number(), z.string().regex(/^@[A-Za-z][\w-]*$/, 'expected a number or a signal reference "@name"')]);
const int = z.number().int();

export const params = z.strictObject({
  width: int.positive().default(270),
  height: int.positive().default(480),
  /** Top of the pavement; buildings and poles stand on it. */
  groundY: int.positive().default(380),
  /** Top-left of the neon sign's frame. */
  sign: z.strictObject({ x: int.default(16), y: int.default(80) }).prefault({}),
  /** Centre x of the street lamp's head. */
  streetlight: z.strictObject({ x: int.default(146) }).prefault({}),
  rain: int.min(0).max(1000).default(240),
  /** Brightness of the neon, the street lamp and the windows: numbers or signals. */
  levels: z.strictObject({ neon: level.default(1), lamp: level.default(1), windows: level.default(1) }).prefault({}),
});
type Config = z.infer<typeof params>;

export const palette = {
  black: '#000000',
  night1: '#05070f',
  night2: '#0e1a2a',
  night3: '#163447',
  farBlock: '#0b111c',
  farRoof: '#141c2a',
  farWindow: '#5a7a90',
  block: '#1a1622',
  roof: '#2a2433',
  amber: '#ffb347',
  pole: '#2a2a34',
  pink: '#ff4f7a',
  teal: '#2fd3c4',
  lamp: '#ffd98a',
  pavement: '#15151e',
  curb: '#22222c',
  road: '#0d0d14',
  puddle: '#3a4a5a',
  rain: '#364956',
  rainLit: '#998253',
};

/** Blocks side by side across [x0, x1), gaps included. rng per block: (width, height, gap). */
function blocks(rng: Rng, x0: number, x1: number, w: [number, number], h: [number, number], gap: [number, number]) {
  const out: { x: number; width: number; height: number }[] = [];
  for (let x = x0; x < x1; ) {
    const width = rng.int(w[0], w[1]);
    out.push({ x, width, height: rng.int(h[0], h[1]) });
    x += width + rng.int(gap[0], gap[1]);
  }
  return out;
}

function generate(cfg: Config, rng: Rng): LayerSpec[] {
  const { width: W, height: H, groundY, levels } = cfg;
  const sx = cfg.sign.x,
    sy = cfg.sign.y;
  const lampX = cfg.streetlight.x;
  const lamp = { x: lampX - 10, y: 102, width: 20, height: 6, color: '$lamp' };
  const cone = { bottom: groundY + 20, slope: 0.42, base: 4 };
  const lampPole = lampX + 34;

  const back: ComponentSpec[] = [
    { id: 'sky', type: 'sky', colors: ['$night1', '$night2', '$night3'], bands: groundY, x: 0, width: W, height: groundY, steps: 4 },
    {
      id: 'farBlocks',
      type: 'buildings',
      baseY: groundY,
      blocks: blocks(rng, -6, W + 6, [18, 40], [140, 240], [0, 3]),
      color: '$farBlock',
      roof: '$farRoof',
      windows: { width: 2, height: 2, gapX: 3, gapY: 4, margin: 3, lit: '$farWindow', bright: 0.5, dark: 0.12, chance: 0.35, rate: 0.25 },
      power: levels.windows,
    },
    {
      id: 'blocks',
      type: 'buildings',
      baseY: groundY,
      blocks: blocks(rng, -10, W + 10, [30, 56], [48, 130], [4, 14]),
      color: '$block',
      roof: '$roof',
      windows: { width: 5, height: 6, gapX: 4, gapY: 5, margin: 4, lit: '$amber', bright: 0.7, dark: 0.15, chance: 0.5, rate: 0.5 },
      power: levels.windows,
    },
  ];

  const street: ComponentSpec[] = [
    {
      id: 'street',
      type: 'ground',
      x: 0,
      width: W,
      bands: [
        { y: groundY, height: 8, color: '$pavement' },
        { y: groundY + 8, height: 2, color: '$curb' },
        { y: groundY + 10, height: H - groundY - 10, color: '$road' },
      ],
      specks: { count: 50, color: '$puddle', alpha: 0.5, x: { base: 0, random: W }, y: { base: groundY + 12, random: H - groundY - 14 } },
    },
    {
      id: 'neonSign',
      type: 'neonSign',
      pole: { x: sx + 40, top: sy + 40, bottom: groundY, width: 6, color: '$pole' },
      tubes: [
        { x: sx, y: sy, width: 104, height: 4, color: '$pink' },
        { x: sx, y: sy + 76, width: 104, height: 4, color: '$pink' },
        { x: sx, y: sy, width: 4, height: 80, color: '$pink' },
        { x: sx + 100, y: sy, width: 4, height: 80, color: '$pink' },
        ...Array.from({ length: 5 }, (_, i) => ({ x: sx + 16, y: sy + 16 + i * 12, width: 72 - i * 8, height: 4, color: '$teal' })),
      ],
      arrow: { x: sx + 44, y: sy + 92, rows: 10, width: 28, step: 2, color: '$amber', chase: { rate: 6, period: 10, on: 7, dim: 0.3 } },
      level: levels.neon,
    },
    {
      id: 'streetlight',
      type: 'streetlight',
      pole: { x: lampPole, top: 100, bottom: groundY, width: 6, color: '$pole' },
      arm: { x: lamp.x + 4, height: 6 },
      lamp,
      cone: { ...cone, alpha: 0.1 },
      pool: { y: groundY + 12, rx: 68, ry: 12, alpha: 0.2 },
      level: levels.lamp,
    },
  ];

  const light: ComponentSpec[] = [
    { id: 'neonGlow', type: 'steppedGlow', x: sx + 52, y: sy + 44, rx: 100, ry: 90, color: '$pink', alpha: 0.3, levels: 4, level: levels.neon },
    {
      id: 'neonReflection',
      type: 'reflection',
      x: sx,
      y: groundY + 12,
      width: 104,
      height: H - groundY - 12,
      rowStep: 2,
      darken: 0.3,
      color: '$pink',
      alpha: 0.2,
      ripple: { rate: 20, period: 12, on: 6 },
      level: levels.neon,
    },
    {
      id: 'lampReflection',
      type: 'reflection',
      x: lampX - 16,
      y: groundY + 24,
      width: 32,
      height: H - groundY - 24,
      rowStep: 2,
      darken: 0.2,
      color: '$lamp',
      alpha: 0.16,
      ripple: { rate: 14, period: 10, on: 4 },
      level: levels.lamp,
    },
  ];

  const weather: ComponentSpec[] = [
    {
      id: 'rain',
      type: 'rain',
      count: cfg.rain,
      x: 0,
      y: 0,
      width: W,
      height: H,
      speed: { base: 200, random: 160 },
      slant: 0.1,
      length: 5,
      color: '$rain',
      lit: [{ x: lampX, y: lamp.y + lamp.height, ...cone, color: '$rainLit' }],
    },
  ];

  return [
    { id: 'backdrop', components: back },
    { id: 'street', components: street },
    { id: 'light', components: light },
    { id: 'weather', components: weather },
  ];
}

export const city: EnvironmentGenerator<Config> = { params, palette, generate };
