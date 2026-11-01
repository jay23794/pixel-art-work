import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { mix, read, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({
  /** Centre x and the y its stand rests on. */
  x: z.number().int(),
  y: z.number().int(),
  /** Outer bezel size. */
  width: z.number().int().min(16),
  height: z.number().int().min(12),
  stand: z.number().int().nonnegative(),
  /**
   * What the screen shows. wave: oscilloscope trace. bars: level meters.
   * code: scrolling text lines. radar: rotating sweep with blips.
   */
  mode: z.enum(['wave', 'bars', 'code', 'radar']),
  /** Animation speed multiplier. */
  speed: z.number().positive().default(1),
  colors: z.strictObject({ bezel: color, bezelShadow: color, screen: color, ink: color, dim: color, led: color }),
  /** Screen glow on the wall behind; alpha × power. */
  glow: z.strictObject({ alpha: z.number().min(0).max(1), size: z.number().int().nonnegative() }),
  /** 0 = off (dark screen), 1 = on. Usually a signal. */
  power: numberOrSignal,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/**
 * A desk monitor with an animated screen. rng: phase, then per mode: bars (one
 * phase per bar), code (40 lines × up to 4 word lengths), radar (6 blips: angle, radius).
 */
export function monitor(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let screen!: Graphics;
  let glow!: Graphics;
  let sx = 0,
    sy = 0,
    sw = 0,
    sh = 0,
    phase = 0;
  const barPhases: number[] = [];
  const lines: number[][] = [];
  const blips: [number, number][] = [];
  return {
    id,
    build(config, rng) {
      cfg = config;
      const { x, y, width, height, stand, colors: c } = cfg;
      const left = x - Math.floor(width / 2),
        top = y - stand - height;
      sx = left + 3;
      sy = top + 3;
      sw = width - 6;
      sh = height - 7;
      phase = rng.range(0, 6.28);
      if (cfg.mode === 'bars') for (let i = 0; i < Math.floor(sw / 4); i++) barPhases.push(rng.range(0, 6.28));
      if (cfg.mode === 'code')
        for (let i = 0; i < 40; i++) {
          const words: number[] = [];
          let room = sw - 2 - rng.int(0, 2) * 2;
          for (let k = rng.int(1, 4); k > 0 && room > 2; k--) {
            const w = Math.min(room, rng.int(2, 8));
            words.push(w);
            room -= w + 1;
          }
          lines.push(words);
        }
      if (cfg.mode === 'radar') for (let i = 0; i < 6; i++) blips.push([rng.range(0, 6.28), rng.range(0.25, 0.9)]);

      const root = new Container();
      glow = new Graphics();
      const gs = cfg.glow.size;
      glow.rect(left - gs, top - gs, width + 2 * gs, height + 2 * gs).fill(c.ink);
      glow.blendMode = 'add';
      root.addChild(glow);
      const body = new Graphics();
      body.rect(x - 2, y - stand, 4, stand).fill(c.bezelShadow);
      body.rect(x - Math.floor(width / 4), y - 2, Math.floor(width / 2), 2).fill(c.bezel);
      body.rect(left, top, width, height).fill(c.bezel);
      body.rect(left, top + height - 1, width, 1).fill(c.bezelShadow);
      body.rect(sx - 1, sy - 1, sw + 2, sh + 2).fill(c.bezelShadow);
      root.addChild(body);
      screen = new Graphics();
      root.addChild(screen);
      return root;
    },
    update(ctx) {
      const c = cfg.colors;
      const on = read(cfg.power, ctx);
      const t = ctx.t * cfg.speed + phase;
      glow.alpha = cfg.glow.alpha * on;
      const g = screen;
      g.clear();
      g.rect(sx, sy, sw, sh).fill(c.screen);
      const led = sx + sw - 1;
      g.rect(led, sy + sh + 2, 1, 1).fill(on ? c.led : c.bezelShadow);
      if (!on) return;
      const px = (x: number, y: number, ink: number): void => void g.rect(x, y, 1, 1).fill(ink);

      if (cfg.mode === 'wave') {
        for (let gx = sx + 3; gx < sx + sw; gx += 6) for (let gy = sy + 3; gy < sy + sh; gy += 6) px(gx, gy, c.dim);
        const mid = sy + sh / 2,
          amp = sh / 2 - 2;
        let prev = Math.round(mid);
        for (let i = 0; i < sw; i++) {
          const v = Math.sin(i * 0.35 + t * 4) * (0.55 + 0.45 * Math.sin(t * 0.9 + i * 0.06));
          const yv = Math.round(mid + v * amp);
          // Join to the previous column so steep parts stay continuous.
          for (let yy = Math.min(prev, yv); yy <= Math.max(prev, yv); yy++) px(sx + i, yy, c.ink);
          prev = yv;
        }
      } else if (cfg.mode === 'bars') {
        barPhases.forEach((ph, i) => {
          const level = 0.5 + 0.5 * Math.sin(t * (1.3 + i * 0.29) + ph);
          const h = Math.max(1, Math.round(level * (sh - 3)));
          g.rect(sx + 1 + i * 4, sy + sh - 1 - h, 3, h).fill(i % 3 === 2 ? c.dim : c.ink);
        });
      } else if (cfg.mode === 'code') {
        const rows = Math.floor((sh - 2) / 3);
        const scroll = Math.floor(t * 2.5);
        for (let r = 0; r < rows; r++) {
          const words = lines[(scroll + r) % lines.length] as number[];
          let wx = sx + 1 + (((scroll + r) * 7) % 3) * 2;
          words.forEach((w, k) => {
            g.rect(wx, sy + 1 + r * 3, w, 1).fill(k === 0 ? c.ink : c.dim);
            wx += w + 1;
          });
        }
        if (Math.floor(t * 2) % 2) g.rect(sx + 1, sy + 1 + rows * 3 - 3, 2, 1).fill(c.ink);
      } else {
        const cx = sx + Math.floor(sw / 2),
          cy = sy + Math.floor(sh / 2),
          rad = Math.floor(Math.min(sw, sh) / 2) - 1;
        for (let a = 0; a < 48; a++) px(Math.round(cx + Math.cos((a / 48) * 6.283) * rad), Math.round(cy + Math.sin((a / 48) * 6.283) * rad), c.dim);
        g.rect(cx - rad, cy, 2 * rad + 1, 1).fill(c.dim);
        g.rect(cx, cy - rad, 1, 2 * rad + 1).fill(c.dim);
        const sweep = (t * 1.6) % 6.283;
        for (let k = 0; k < rad; k++) px(Math.round(cx + Math.cos(sweep) * k), Math.round(cy + Math.sin(sweep) * k), c.ink);
        for (const [ang, r] of blips) {
          // Bright right after the sweep passes, fading over the next turn.
          const since = (((sweep - ang) % 6.283) + 6.283) % 6.283;
          px(Math.round(cx + Math.cos(ang) * r * rad), Math.round(cy + Math.sin(ang) * r * rad), mix(c.ink, c.screen, since / 6.283));
        }
      }
      // Scanlines.
      for (let yy = sy + 1; yy < sy + sh; yy += 2) g.rect(sx, yy, sw, 1).fill({ color: 0x000000, alpha: 0.18 });
    },
  };
}
