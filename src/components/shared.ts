import { Container } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { FrameContext } from '../core/context.ts';

// Helpers shared by the Desert Lab components. Expressions match legacy/scene.html
// exactly (including evaluation order) so the port stays pixel-identical.

export const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

/** Blends two 0xRRGGBB colours. Channels are truncated by the bitwise ops, as in legacy. */
export const mix = (c1: number, c2: number, f: number): number => {
  const r = lerp(c1 >> 16, c2 >> 16, f),
    g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, f),
    b = lerp(c1 & 255, c2 & 255, f);
  return (r << 16) | (g << 8) | b;
};

/** Height of the Desert Lab world in pixels (the camera shows the bottom part). */
export const WORLD_H = 840;

/** 1 while the trailer lights are on, 0 after they shut off. */
export const lightsOn = (t: number): number => (t > 37.2 ? 0 : 1);

/** 1 while the string lights are on, 0 after they shut off. */
export const bulbsOn = (t: number): number => (t > 36.2 ? 0 : 1);

/** Trailer window/door light level. */
export const windowLight = (ctx: FrameContext): number =>
  (0.55 + 0.45 * ctx.pulse) * (0.8 + 0.2 * ctx.env) * lightsOn(ctx.t);

/** The camp group (trailer, generator, string lights, props, smoke) shares one anchor. */
const CAMP = { x: 118, y: 646, parallax: 0.7 } as const;

export function campRoot(): Container {
  const root = new Container();
  root.x = CAMP.x;
  root.y = CAMP.y;
  return root;
}

export function placeAtCamp(root: Container, t: number): void {
  root.x = CAMP.x + parallaxX(t, CAMP.parallax);
}
