import { z } from 'zod';
import type { FrameContext } from '../core/context.ts';
import type { NumberOrSignal, SceneEvent } from '../scene/primitives.ts';

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
