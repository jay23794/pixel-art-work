// Renders one study frame. Shared by the lab page and the CLI, so both draw identical pixels.
import { createBuffer } from './lib/buffer.ts';
import { lockToPalette } from './lib/palette.ts';
import { createRng, type Rng } from './lib/rng.ts';

/** A slider: the page builds one per param, the CLI fills in `value` unless overridden. */
export interface Slider {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
}

export interface Study {
  readonly name: string;
  readonly params: Readonly<Record<string, Slider>>;
  /** Loop length in seconds (scrubber range; default 10). */
  readonly duration?: number;
  /** Draws frame t (seconds) into a 360×640 RGBA buffer. */
  draw(buf: Uint8ClampedArray, t: number, rng: Rng, params: Readonly<Record<string, number>>): void;
}

/** Param values: slider defaults, then overrides. Unknown keys are an error. */
export function resolveParams(study: Study, overrides: Readonly<Record<string, number>> = {}): Record<string, number> {
  for (const k of Object.keys(overrides)) if (!(k in study.params)) throw new Error(`study "${study.name}" has no param "${k}" (params: ${Object.keys(study.params).join(', ')})`);
  return Object.fromEntries(Object.entries(study.params).map(([k, s]) => [k, overrides[k] ?? s.value]));
}

/**
 * Draws frame t with a fresh rng (same seed → same picture every frame), then locks
 * every pixel to the art-direction palette as a safety net.
 */
export function renderStudy(study: Study, t: number, params: Readonly<Record<string, number>>, seed = 1): Uint8ClampedArray {
  const buf = createBuffer();
  study.draw(buf, t, createRng(seed), params);
  lockToPalette(buf);
  return buf;
}
