import { Graphics } from 'pixi.js';
import { z } from 'zod';
import type { FrameContext } from '../core/context.ts';
import type { LightCurve, SceneEvent, Shape } from '../scene/primitives.ts';

// Helpers shared by components. Expressions keep the legacy evaluation order so
// the JSON-driven scene stays pixel-identical to legacy/scene.html.

/** Component config as passed by the factory: validated params plus the events aimed at it. */
export type WithEvents<P> = P & { readonly events: readonly SceneEvent[] };

/** Event action schemas a component accepts (action → params schema). */
export type Actions = Record<string, z.ZodType>;
export const noParams = z.strictObject({});
export const durationParams = z.strictObject({ duration: z.number().positive() });

export const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

/** Blends two 0xRRGGBB colours. Channels are truncated by the bitwise ops, as in legacy. */
export const mix = (c1: number, c2: number, f: number): number => {
  const r = lerp(c1 >> 16, c2 >> 16, f),
    g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, f),
    b = lerp(c1 & 255, c2 & 255, f);
  return (r << 16) | (g << 8) | b;
};

/**
 * 1 if the component's light is on at t, else 0.
 * lightsOn at T: off until t > T. lightsOff at T: off once t > T.
 */
export function lit(events: readonly SceneEvent[], t: number): number {
  let on = 1;
  for (const e of events) {
    if (e.action === 'lightsOn' && !(t > e.time)) on = 0;
    if (e.action === 'lightsOff' && t > e.time) on = 0;
  }
  return on;
}

/** (base + pulse·p) × (envBase + env·e) × on */
export const lightLevel = (curve: LightCurve, ctx: FrameContext, on: number): number =>
  (curve.base + curve.pulse * ctx.pulse) * (curve.envBase + curve.env * ctx.env) * on;

/** Draws shapes in order into g. */
export function drawShapes(g: Graphics, shapes: readonly Shape[]): void {
  for (const s of shapes) {
    const n = s.repeat?.count ?? 1;
    for (let i = 0; i < n; i++) {
      const x = s.x + i * (s.repeat?.dx ?? 0);
      const y = s.y + i * (s.repeat?.dy ?? 0);
      if (s.type === 'rect') g.rect(x, y, s.w, s.h);
      else if (s.type === 'roundRect') g.roundRect(x, y, s.w, s.h, s.r);
      else g.circle(x, y, s.r);
      if (s.alpha === undefined) g.fill(s.color);
      else g.fill({ color: s.color, alpha: s.alpha });
    }
  }
}
