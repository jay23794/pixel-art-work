import { z } from 'zod';

// Building blocks shared by the scene schema and the component param schemas.

/** "#rrggbb" → 0xrrggbb. Palette references ("$name") are resolved by the loader before this runs. */
export const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'expected a colour "#rrggbb" or a palette reference "$name"')
  .transform((s) => parseInt(s.slice(1), 16));

export const nonNegative = z.number().nonnegative();
export const positive = z.number().positive();
export const count = z.number().int().nonnegative();

/** A random value: base + rng() × random. */
export const randomValue = z.strictObject({ base: z.number(), random: z.number() });
export type RandomValue = z.infer<typeof randomValue>;

/** Parallax factor: the layer moves by round(-camera.x × parallax) pixels. */
export const parallax = z.number().default(0);

/** "@name" → the signal's name. The loader checks the signal exists. */
export const signalRef = z
  .string()
  .regex(/^@[A-Za-z][\w-]*$/, 'expected a signal reference "@name"')
  .transform((s) => s.slice(1));

/** A number, or "@name" for a signal read every frame from ctx.signals. */
export const numberOrSignal = z.union([z.number(), signalRef]);
export type NumberOrSignal = z.infer<typeof numberOrSignal>;

/** A scheduled change for one component, e.g. lights off or a shooting star. */
export interface SceneEvent {
  readonly time: number;
  readonly target: string;
  readonly action: string;
  readonly params: Record<string, unknown>;
}
