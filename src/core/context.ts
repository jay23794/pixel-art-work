import type { CameraState } from '../camera/camera.ts';

// Per-frame state handed to every component. Rendering is a pure function of it.

export interface Timing {
  readonly fps: number;
  /** Scene length in seconds. */
  readonly duration: number;
  /** Logical canvas size in pixels. */
  readonly width: number;
  readonly height: number;
}

export interface FrameContext extends Timing {
  /** Frame index, 0-based. */
  readonly n: number;
  /** Time in seconds: n / fps. */
  readonly t: number;
  /** Glow/beat stand-in in [0, 1]. Will come from audio later. */
  readonly pulse: number;
  /** Loudness stand-in in [0, 1]. Will come from audio later. */
  readonly env: number;
  /** Exact camera position at t (see src/camera/camera.ts). */
  readonly camera: CameraState;
}

/** Time-based stand-in for the music pulse (no audio for now). */
export const pulseAt = (t: number): number => 0.5 + 0.5 * Math.sin(t * 2);

/** Constant stand-in for the loudness envelope (no audio for now). */
export const ENV_CONSTANT = 0.5;

export function createFrameContext(n: number, timing: Timing, camera: (t: number) => CameraState = () => ({ x: 0, y: 0 })): FrameContext {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`frame index must be a non-negative integer, got ${n}`);
  if (!(timing.fps > 0)) throw new RangeError(`fps must be positive, got ${timing.fps}`);
  const t = n / timing.fps;
  return {
    n,
    t,
    fps: timing.fps,
    duration: timing.duration,
    width: timing.width,
    height: timing.height,
    pulse: pulseAt(t),
    env: ENV_CONSTANT,
    camera: camera(t),
  };
}
