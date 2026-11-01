import type { Container } from 'pixi.js';

// Minimal camera: a fixed framing plus a slow horizontal pan in whole pixels.

export interface CameraConfig {
  /** World y shown at the vertical centre of the screen. */
  readonly focusY: number;
}

/** Frames the world: world x = width/2 and y = focusY land at the screen centre. */
export function applyCamera(world: Container, camera: CameraConfig, width: number, height: number): void {
  world.pivot.set(width / 2, camera.focusY);
  world.position.set(width / 2, height / 2);
}

/** Horizontal pan in pixels at time t. Same curve as the legacy scene. */
export const panX = (t: number): number => Math.sin(t * 0.12) * 14 - 4;

/** Whole-pixel x offset for a layer that moves at `factor` × the pan (parallax). */
export const parallaxX = (t: number, factor: number): number => Math.round(panX(t) * factor);
