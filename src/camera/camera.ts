import type { Container } from 'pixi.js';

// Minimal camera: keyframed position. Only a whole-pixel horizontal pan is used
// for now. x: camera position in pixels (+ = right, so the scene shifts left).
// y: world y shown at the vertical centre of the screen.

export const EASINGS = {
  linear: (u: number) => u,
  easeInQuad: (u: number) => u * u,
  easeOutQuad: (u: number) => u * (2 - u),
  easeInOutQuad: (u: number) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)),
  easeInSine: (u: number) => 1 - Math.cos((u * Math.PI) / 2),
  easeOutSine: (u: number) => Math.sin((u * Math.PI) / 2),
  easeInOutSine: (u: number) => (1 - Math.cos(Math.PI * u)) / 2,
} as const satisfies Record<string, (u: number) => number>;
export type Easing = keyof typeof EASINGS;

export interface Keyframe {
  readonly time: number;
  readonly x: number;
  readonly y: number;
  /** Easing used to move from the previous keyframe to this one. */
  readonly easing: Easing;
}

export interface CameraConfig {
  /** Sorted by time; at least one. Held before the first and after the last. */
  readonly keyframes: readonly Keyframe[];
}

export interface CameraState {
  readonly x: number;
  readonly y: number;
}

/** Exact (unrounded) camera position at time t. */
export function evaluateCamera(camera: CameraConfig, t: number): CameraState {
  const kfs = camera.keyframes;
  const first = kfs[0];
  if (!first) return { x: 0, y: 0 };
  if (t <= first.time) return { x: first.x, y: first.y };
  for (let i = 1; i < kfs.length; i++) {
    const a = kfs[i - 1] as Keyframe;
    const b = kfs[i] as Keyframe;
    if (t <= b.time) {
      const e = EASINGS[b.easing]((t - a.time) / (b.time - a.time));
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
  }
  const last = kfs[kfs.length - 1] as Keyframe;
  return { x: last.x, y: last.y };
}

/**
 * Whole-pixel x offset of a layer that moves at `parallax` × the camera
 * (0 = fixed, 1 = moves with the world). Rounding happens here, after the
 * parallax multiply, so every layer lands on whole pixels.
 */
export const parallaxX = (camera: CameraState, parallax: number): number => Math.round(-camera.x * parallax);

/** Frames the world: world x = width/2 and y = round(camera.y) land at the screen centre. */
export function applyCamera(world: Container, camera: CameraState, width: number, height: number): void {
  world.pivot.set(width / 2, Math.round(camera.y));
  world.position.set(width / 2, height / 2);
}
