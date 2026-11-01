import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, count } from '../scene/primitives.ts';
import { mix, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({
  /** Outer frame rectangle. */
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frame: z.strictObject({ width: z.number().int().positive(), color, shadow: color }),
  /** Glazing bars dividing the opening into cols × rows panes. */
  panes: z.strictObject({ cols: z.number().int().positive(), rows: z.number().int().positive(), color }),
  /** Night sky, top → bottom, in equal bands. */
  sky: z.array(color).min(1),
  /** Twinkling stars. rng per star: (x, y, phase, speed). */
  stars: z.strictObject({ count, color }),
  /** Distant buildings along the bottom. rng per building: (width, height, then one roll per window slot). */
  skyline: z.strictObject({ color, lit: color, litChance: z.number().min(0).max(1), maxHeight: z.number().int().positive() }),
  /** Diagonal reflections on the glass. */
  glare: z.strictObject({ color, alpha: z.number().min(0).max(1) }),
  sill: z.strictObject({ height: z.number().int().positive(), overhang: z.number().int().nonnegative(), color, shadow: color }),
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

interface Star {
  x: number;
  y: number;
  ph: number;
  sp: number;
}

/** A framed window onto a night skyline, with twinkling stars. */
export function roomWindow(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let starG!: Graphics;
  const stars: Star[] = [];
  let sky0 = 0;
  return {
    id,
    build(config, rng) {
      cfg = config;
      const fw = cfg.frame.width;
      const ix = cfg.x + fw,
        iy = cfg.y + fw,
        iw = cfg.width - 2 * fw,
        ih = cfg.height - 2 * fw;
      const root = new Container();

      const back = new Graphics();
      const band = ih / cfg.sky.length;
      cfg.sky.forEach((c, i) => back.rect(ix, Math.round(iy + i * band), iw, Math.ceil(band)).fill(c));
      sky0 = cfg.sky[0] as number;
      root.addChild(back);

      for (let i = 0; i < cfg.stars.count; i++)
        stars.push({ x: ix + rng.int(1, iw - 2), y: iy + rng.int(1, Math.floor(ih * 0.6)), ph: rng.range(0, 6.28), sp: rng.range(1, 3) });
      starG = new Graphics();
      root.addChild(starG);

      const city = new Graphics();
      const sl = cfg.skyline;
      for (let bx = ix; bx < ix + iw; ) {
        const bw = Math.min(rng.int(6, 14), ix + iw - bx),
          bh = rng.int(Math.ceil(sl.maxHeight / 3), sl.maxHeight);
        city.rect(bx, iy + ih - bh, bw, bh).fill(sl.color);
        for (let wy = iy + ih - bh + 2; wy < iy + ih - 1; wy += 3)
          for (let wx = bx + 1; wx < bx + bw - 1; wx += 2) if (rng.next() < sl.litChance) city.rect(wx, wy, 1, 1).fill(sl.lit);
        bx += bw + rng.int(0, 2);
      }
      root.addChild(city);

      const glass = new Graphics();
      for (const [off, len] of [[6, 18], [12, 8], [iw - 20, 14]] as const)
        for (let k = 0; k < len; k++) {
          const gx = ix + off + k,
            gy = iy + ih - 6 - k;
          if (gx < ix + iw && gy > iy) glass.rect(gx, gy, 1, 1).fill({ color: cfg.glare.color, alpha: cfg.glare.alpha });
        }
      root.addChild(glass);

      const frame = new Graphics();
      const p = cfg.panes;
      for (let c = 1; c < p.cols; c++) frame.rect(Math.round(ix + (c * iw) / p.cols) - 1, iy, 2, ih).fill(p.color);
      for (let r = 1; r < p.rows; r++) frame.rect(ix, Math.round(iy + (r * ih) / p.rows) - 1, iw, 2).fill(p.color);
      frame.rect(cfg.x, cfg.y, cfg.width, fw).fill(cfg.frame.color);
      frame.rect(cfg.x, cfg.y + cfg.height - fw, cfg.width, fw).fill(cfg.frame.color);
      frame.rect(cfg.x, cfg.y, fw, cfg.height).fill(cfg.frame.color);
      frame.rect(cfg.x + cfg.width - fw, cfg.y, fw, cfg.height).fill(cfg.frame.color);
      frame.rect(ix, iy, iw, 1).fill(cfg.frame.shadow);
      frame.rect(ix, iy, 1, ih).fill(cfg.frame.shadow);
      const s = cfg.sill;
      frame.rect(cfg.x - s.overhang, cfg.y + cfg.height, cfg.width + 2 * s.overhang, s.height).fill(s.color);
      frame.rect(cfg.x - s.overhang, cfg.y + cfg.height + s.height, cfg.width + 2 * s.overhang, 1).fill(s.shadow);
      root.addChild(frame);
      return root;
    },
    update(ctx) {
      starG.clear();
      for (const s of stars) starG.rect(s.x, s.y, 1, 1).fill(mix(sky0, cfg.stars.color, 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ctx.t * s.sp + s.ph))));
    },
  };
}
