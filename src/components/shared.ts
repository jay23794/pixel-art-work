import { Graphics } from 'pixi.js';
import { z } from 'zod';
import type { FrameContext } from '../core/context.ts';
import type { NumberOrSignal, SceneEvent, Shape } from '../scene/primitives.ts';

// Helpers shared by components. Expressions keep the legacy evaluation order so
// the JSON-driven scene stays pixel-identical to legacy/scene.html.

/** Component config as passed by the factory: validated params plus the events aimed at it. */
export type WithEvents<P> = P & { readonly events: readonly SceneEvent[] };

/** Event action schemas a component accepts (action → params schema). */
export type Actions = Record<string, z.ZodType>;
export const durationParams = z.strictObject({ duration: z.number().positive() });

export const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

/** Blends two 0xRRGGBB colours. Channels are truncated by the bitwise ops, as in legacy. */
export const mix = (c1: number, c2: number, f: number): number => {
  const r = lerp(c1 >> 16, c2 >> 16, f),
    g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, f),
    b = lerp(c1 & 255, c2 & 255, f);
  return (r << 16) | (g << 8) | b;
};

/** A param that is either a constant or a signal name (from "@name"), read for this frame. */
export function read(v: NumberOrSignal, ctx: FrameContext): number {
  if (typeof v === 'number') return v;
  const value = ctx.signals[v];
  if (value === undefined) throw new Error(`signal "@${v}" is not defined`);
  return value;
}

/** Draws shapes in order into g, each shifted by (-ox, -oy) (e.g. an asset's anchor). */
export function drawShapes(g: Graphics, shapes: readonly Shape[], ox = 0, oy = 0): void {
  for (const s of shapes) {
    const n = s.repeat?.count ?? 1;
    for (let i = 0; i < n; i++) {
      const x = s.x + i * (s.repeat?.dx ?? 0) - ox;
      const y = s.y + i * (s.repeat?.dy ?? 0) - oy;
      const style = s.alpha === undefined ? s.color : { color: s.color, alpha: s.alpha };
      if (s.type === 'curve') {
        g.moveTo(x, y)
          .quadraticCurveTo(s.control[0] - ox, s.control[1] - oy, s.to[0] - ox, s.to[1] - oy)
          .stroke(s.alpha === undefined ? { width: s.width, color: s.color } : { width: s.width, color: s.color, alpha: s.alpha });
        continue;
      }
      if (s.type === 'rect') g.rect(x, y, s.w, s.h);
      else if (s.type === 'roundRect') g.roundRect(x, y, s.w, s.h, s.r);
      else g.circle(x, y, s.r);
      g.fill(style);
    }
  }
}
