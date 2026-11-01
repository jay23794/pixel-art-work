import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { mix, read, type Actions, type WithEvents } from './shared.ts';

const int = z.number().int();

export const params = z.strictObject({
  /** Ground line the buildings stand on. */
  baseY: int,
  /** Left edge, width and height of each building, back to front. */
  blocks: z.array(z.strictObject({ x: int, width: int.positive(), height: int.positive() })).min(1),
  color,
  /** 1px line along each roof. */
  roof: color,
  /** Window grid inside each building. */
  windows: z.strictObject({
    width: int.positive(),
    height: int.positive(),
    gapX: int.nonnegative(),
    gapY: int.nonnegative(),
    /** Inset from the walls and roof; no windows in the bottom `margin` rows either. */
    margin: int.nonnegative(),
    /** Lit colour; an unlit window is lit × dark, a lit one lit × bright (× power). */
    lit: color,
    bright: z.number().min(0).max(1),
    dark: z.number().min(0).max(1),
    /** Fraction of windows that ever light up. */
    chance: z.number().min(0).max(1),
    /** A window is lit while floor(phase + t·rate) mod 3 ≠ 0 (legacy motel windows). */
    rate: z.number().nonnegative(),
  }),
  /** Scales the lit windows, usually a signal. */
  power: numberOrSignal.default(1),
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

interface Pane {
  x: number;
  y: number;
  /** undefined: never lit. */
  phase: number | undefined;
}

/** City blocks with grids of windows that switch on and off. rng per window: (lights?, phase). */
export function buildings(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let panesG!: Graphics;
  const panes: Pane[] = [];
  return {
    id,
    build(config, rng) {
      cfg = config;
      const w = cfg.windows;
      const root = new Container();
      const g = new Graphics();
      for (const b of cfg.blocks) {
        const top = cfg.baseY - b.height;
        g.rect(b.x, top, b.width, b.height).fill(cfg.color);
        g.rect(b.x, top, b.width, 1).fill(cfg.roof);
        for (let y = top + w.margin; y + w.height <= cfg.baseY - w.margin; y += w.height + w.gapY)
          for (let x = b.x + w.margin; x + w.width <= b.x + b.width - w.margin; x += w.width + w.gapX) {
            const lights = rng.next() < w.chance;
            const phase = rng.range(0, 3);
            panes.push({ x, y, phase: lights ? phase : undefined });
          }
      }
      root.addChild(g);
      panesG = new Graphics();
      root.addChild(panesG);
      return root;
    },
    update(ctx) {
      const w = cfg.windows;
      const power = read(cfg.power, ctx);
      const dark = mix(0, w.lit, w.dark),
        bright = mix(0, w.lit, w.bright * power);
      panesG.clear();
      for (const p of panes) {
        const on = p.phase !== undefined && Math.floor(p.phase + ctx.t * w.rate) % 3 !== 0;
        panesG.rect(p.x, p.y, w.width, w.height).fill(on ? bright : dark);
      }
    },
  };
}
