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

/** Light level curve: (base + pulse·ctx.pulse) × (envBase + env·ctx.env), times 1/0 for on/off. */
export const lightCurve = z.strictObject({
  base: z.number(),
  pulse: z.number(),
  envBase: z.number().default(1),
  env: z.number().default(0),
});
export type LightCurve = z.infer<typeof lightCurve>;

const shapeCommon = {
  color,
  alpha: z.number().min(0).max(1).optional(),
  /** Draw `count` copies, each shifted by (dx, dy). */
  repeat: z.strictObject({ count: z.number().int().positive(), dx: z.number().default(0), dy: z.number().default(0) }).optional(),
};

/** A filled primitive, drawn in list order into one Graphics. */
export const shape = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('rect'), x: z.number(), y: z.number(), w: z.number(), h: z.number(), ...shapeCommon }),
  z.strictObject({ type: z.literal('roundRect'), x: z.number(), y: z.number(), w: z.number(), h: z.number(), r: z.number(), ...shapeCommon }),
  z.strictObject({ type: z.literal('circle'), x: z.number(), y: z.number(), r: z.number(), ...shapeCommon }),
]);
export type Shape = z.infer<typeof shape>;

/** A scheduled change for one component, e.g. lights off or a shooting star. */
export interface SceneEvent {
  readonly time: number;
  readonly target: string;
  readonly action: string;
  readonly params: Record<string, unknown>;
}
