import { z } from 'zod';
import type { ComponentSpec, EnvironmentGenerator, LayerSpec } from '../../core/environment.ts';
import type { Rng } from '../../core/random.ts';

// A night-time laboratory: panelled wall with a window onto the city, tiled
// floor, a workbench with glassware, monitors and fluorescent ceiling lights.
// The rng decides the monitors (screen modes, sizes, positions), the glassware
// and which ceiling light is faulty; each component then draws from its own stream.

/** A constant level or a scene signal "@name" (checked by the loader). */
const level = z.union([z.number(), z.string().regex(/^@[A-Za-z][\w-]*$/, 'expected a number or a signal reference "@name"')]);
const int = z.number().int();

export const params = z.strictObject({
  /** Room size in logical pixels; the room starts at (0, 0). */
  width: int.positive().default(270),
  height: int.positive().default(480),
  /** Bottom of the ceiling strip and top of the floor. */
  ceilingY: int.positive().default(34),
  floorY: int.positive().default(336),
  window: z
    .strictObject({ x: int.default(150), y: int.default(74), width: int.min(24).default(92), height: int.min(24).default(120) })
    .prefault({}),
  bench: z.strictObject({ x: int.default(12), y: int.default(290), width: int.min(80).default(246) }).prefault({}),
  monitors: int.min(0).max(4).default(3),
  lights: int.min(0).max(4).default(2),
  /** Pieces of glassware on the bench (fewer if they don't fit). */
  glassware: int.min(0).max(12).default(6),
  /** One ceiling light flickers. */
  faultyLight: z.boolean().default(true),
  /** Ceiling lights and screens: 0 = off, 1 = on. Usually signals. */
  power: z.strictObject({ lights: level.default(1), screens: level.default(1) }).prefault({}),
});
type Config = z.infer<typeof params>;

export const palette = {
  black: '#000000',
  ceiling: '#161a26',
  ceilingSeam: '#0f121b',
  ceilingHi: '#1f2433',
  ceilingTrim: '#2b3142',
  wall: '#2b3848',
  wallSeam: '#1f2a37',
  wallHi: '#34445a',
  wallRail: '#3f526a',
  wallRailShadow: '#1a2330',
  baseboard: '#141a24',
  stain: '#1a2330',
  frame: '#4c5a6b',
  frameShadow: '#2a3442',
  sill: '#5d6d80',
  sillShadow: '#1a2330',
  night0: '#080c1e',
  night1: '#0e1530',
  night2: '#172142',
  night3: '#222d55',
  star: '#e8f0ff',
  city: '#0a0e1a',
  cityLit: '#ffcf6a',
  glare: '#9fd8ff',
  tileA: '#3a4048',
  tileB: '#2f343c',
  grout: '#1f2329',
  floorSpeck: '#5a6676',
  benchTop: '#6b4a32',
  benchHi: '#8a6446',
  benchEdge: '#4a3222',
  benchLeg: '#262b34',
  cabinet: '#363d48',
  handle: '#8a96a6',
  shadow: '#10141b',
  glass: '#a8c8d8',
  liquidPink: '#ff5a8a',
  liquidGreen: '#5aff9a',
  liquidBlue: '#5ac8ff',
  liquidGold: '#ffd25a',
  bezel: '#3c4250',
  bezelShadow: '#22262f',
  screen: '#041410',
  screenGreen: '#48ff9a',
  screenGreenDim: '#1d6a44',
  screenAmber: '#ffb84a',
  screenAmberDim: '#6a4a1d',
  screenCyan: '#5ad8ff',
  screenCyanDim: '#1d566a',
  led: '#40ff70',
  housing: '#8a929e',
  housingShadow: '#4a515c',
  tubeOff: '#4a525e',
  tubeOn: '#f4fbff',
  beam: '#cfe8ff',
};

const MODES = ['wave', 'bars', 'code', 'radar'] as const;
const INK = {
  wave: ['$screenGreen', '$screenGreenDim'],
  bars: ['$screenAmber', '$screenAmberDim'],
  code: ['$screenGreen', '$screenGreenDim'],
  radar: ['$screenCyan', '$screenCyanDim'],
} as const;
const LIQUIDS = ['$liquidPink', '$liquidGreen', '$liquidBlue', '$liquidGold'];
const KINDS = ['beaker', 'flask', 'jar'] as const;

/** Fisher–Yates with the generator's rng. */
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** rng: modes (shuffle), then per monitor (x jitter, width, stand height). */
function monitors(cfg: Config, rng: Rng): ComponentSpec[] {
  const { bench, monitors: n } = cfg;
  const modes = shuffle(MODES, rng);
  const slot = bench.width / Math.max(n, 1);
  return Array.from({ length: n }, (_, i) => {
    const mode = modes[i % modes.length] as (typeof MODES)[number];
    const x = Math.round(bench.x + slot * (i + 0.5)) + rng.int(-4, 4);
    const width = Math.min(rng.int(36, 46), Math.floor(slot) - 6);
    const [ink, dim] = INK[mode];
    return {
      id: `monitor${i + 1}`,
      type: 'monitor',
      x,
      y: bench.y,
      width,
      height: Math.round(width * 0.72),
      stand: rng.int(3, 6),
      mode,
      colors: { bezel: '$bezel', bezelShadow: '$bezelShadow', screen: '$screen', ink, dim, led: '$led' },
      glow: { alpha: 0.05, size: 3 },
      power: cfg.power.screens,
    };
  });
}

/** rng: per attempt (width, x, kind); per placed item (height, liquid, fill, bubbles). */
function glassware(cfg: Config, taken: [number, number][], rng: Rng): Record<string, unknown>[] {
  const { bench } = cfg;
  const items: Record<string, unknown>[] = [];
  for (let attempt = 0; attempt < 60 && items.length < cfg.glassware; attempt++) {
    const width = rng.int(5, 9);
    const x = rng.int(bench.x + 6, bench.x + bench.width - 6);
    const kind = rng.pick(KINDS);
    const span: [number, number] = [x - Math.ceil(width / 2) - 2, x + Math.ceil(width / 2) + 2];
    if (taken.some(([a, b]) => span[0] < b && a < span[1])) continue;
    taken.push(span);
    const height = width + (kind === 'flask' ? rng.int(4, 8) : rng.int(0, 3));
    items.push({ kind, x, width, height, liquid: rng.pick(LIQUIDS), fill: Math.round(rng.range(0.3, 0.8) * 100) / 100, bubbles: rng.int(0, 3) });
  }
  return items.sort((a, b) => (a.x as number) - (b.x as number));
}

function generate(cfg: Config, rng: Rng): LayerSpec[] {
  const { width: W, height: H, ceilingY, floorY, bench } = cfg;
  const screens = monitors(cfg, rng);
  const taken = screens.map((m): [number, number] => [(m.x as number) - (m.width as number) / 2 - 2, (m.x as number) + (m.width as number) / 2 + 2]);
  const items = glassware(cfg, taken, rng);
  const faulty = cfg.faultyLight && cfg.lights > 0 ? rng.int(0, cfg.lights - 1) : -1;

  const room: ComponentSpec[] = [
    {
      id: 'ceiling',
      type: 'wall',
      x: 0,
      y: 0,
      width: W,
      height: ceilingY,
      color: '$ceiling',
      panels: { width: 45, seam: '$ceilingSeam', highlight: '$ceilingHi' },
      baseboard: { height: 2, color: '$ceilingTrim' },
    },
    {
      id: 'wall',
      type: 'wall',
      x: 0,
      y: ceilingY,
      width: W,
      height: floorY - ceilingY,
      color: '$wall',
      panels: { width: 30, seam: '$wallSeam', highlight: '$wallHi' },
      rail: { y: Math.round((floorY - ceilingY) * 0.62), height: 3, color: '$wallRail', shadow: '$wallRailShadow' },
      baseboard: { height: 4, color: '$baseboard' },
      stains: { count: 30, color: '$stain', alpha: 0.35, maxSize: 5 },
    },
    {
      id: 'window',
      type: 'window',
      ...cfg.window,
      frame: { width: 4, color: '$frame', shadow: '$frameShadow' },
      panes: { cols: 2, rows: 2, color: '$frame' },
      sky: ['$night0', '$night1', '$night2', '$night3'],
      stars: { count: 18, color: '$star' },
      skyline: { color: '$city', lit: '$cityLit', litChance: 0.25, maxHeight: Math.round(cfg.window.height * 0.25) },
      glare: { color: '$glare', alpha: 0.25 },
      sill: { height: 3, overhang: 3, color: '$sill', shadow: '$sillShadow' },
    },
    {
      id: 'floor',
      type: 'floor',
      x: 0,
      y: floorY,
      width: W,
      height: H - floorY,
      vanishX: Math.round(W / 2),
      tile: { width: 16, height: 4, grow: 1.13 },
      colors: ['$tileA', '$tileB'],
      grout: '$grout',
      specks: { count: 40, color: '$floorSpeck', alpha: 0.4 },
    },
  ];

  const workbench: ComponentSpec = {
    id: 'workbench',
    type: 'workbench',
    ...bench,
    thickness: 6,
    legHeight: floorY + 16 - bench.y,
    colors: {
      top: '$benchTop',
      highlight: '$benchHi',
      edge: '$benchEdge',
      leg: '$benchLeg',
      cabinet: '$cabinet',
      handle: '$handle',
      shadow: '$shadow',
      glass: '$glass',
    },
    cabinet: { width: 58, drawers: 3 },
    items,
  };

  const lights: ComponentSpec[] = Array.from({ length: cfg.lights }, (_, i) => ({
    id: `light${i + 1}`,
    type: 'ceilingLight',
    x: Math.round((W * (i + 0.5)) / cfg.lights),
    y: ceilingY,
    width: 40,
    colors: { housing: '$housing', shadow: '$housingShadow', tubeOff: '$tubeOff', tubeOn: '$tubeOn', beam: '$beam' },
    beam: { length: floorY + 60 - ceilingY, spread: 30, steps: 4, alpha: 0.15 },
    ...(i === faulty ? { flicker: { rate: 9, chance: 0.12, dim: 0.2 } } : {}),
    power: cfg.power.lights,
  }));

  return [
    { id: 'room', components: room },
    { id: 'bench', components: [workbench, ...screens] },
    { id: 'lights', components: lights },
  ];
}

export const laboratory: EnvironmentGenerator<Config> = { params, palette, generate };
