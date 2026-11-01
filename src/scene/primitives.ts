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

const shapeCommon = {
  color,
  alpha: z.number().min(0).max(1).optional(),
  /** Draw `count` copies, each shifted by (dx, dy). */
  repeat: z.strictObject({ count: z.number().int().positive(), dx: z.number().default(0), dy: z.number().default(0) }).optional(),
};

const point = z.tuple([z.number(), z.number()]);

/** A filled primitive (or a stroked curve), drawn in list order into one Graphics. */
export const shape = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('rect'), x: z.number(), y: z.number(), w: z.number(), h: z.number(), ...shapeCommon }),
  z.strictObject({ type: z.literal('roundRect'), x: z.number(), y: z.number(), w: z.number(), h: z.number(), r: z.number(), ...shapeCommon }),
  z.strictObject({ type: z.literal('circle'), x: z.number(), y: z.number(), r: z.number(), ...shapeCommon }),
  /** Quadratic curve stroke (x/y is its start point). */
  z.strictObject({ type: z.literal('curve'), x: z.number(), y: z.number(), control: point, to: point, width: z.number().positive(), ...shapeCommon }),
]);
export type Shape = z.infer<typeof shape>;

/** Static drawn art in assets/shapes/<id>.json. Coordinates are local: (0, 0) is the top-left of the box. */
export const shapeAssetSchema = z.strictObject({
  id: z.string(),
  type: z.literal('shape'),
  /** Bounding box of the art. */
  width: z.number().positive(),
  height: z.number().positive(),
  /** Local point that lands on the placing component's (x, y). */
  anchor: z.strictObject({ x: z.number(), y: z.number() }),
  shapes: z.array(shape).min(1),
});
export type ShapeAsset = z.infer<typeof shapeAssetSchema>;

/** A scheduled change for one component, e.g. lights off or a shooting star. */
export interface SceneEvent {
  readonly time: number;
  readonly target: string;
  readonly action: string;
  readonly params: Record<string, unknown>;
}
