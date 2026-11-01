import { z } from 'zod';
import { EASINGS, type Easing } from '../camera/camera.ts';

// Scene file format, version 1. Structural validation only: component params,
// event actions and palette references are checked by the loader against the
// registry (see loader.ts), which reports errors with the same JSON paths.

const id = z.string().regex(/^[A-Za-z][\w-]*$/, 'ids start with a letter and use letters, digits, "_" or "-"');
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a colour "#rrggbb"');
const time = z.number().nonnegative();

export const outputSchema = z
  .strictObject({
    /** Final video size in pixels. */
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /** Size of the pixel-art canvas; all scene coordinates use it. */
    logicalWidth: z.number().int().positive(),
    logicalHeight: z.number().int().positive(),
    fps: z.number().positive(),
    /** Seconds. */
    duration: z.number().positive(),
    background: hex.default('#000000'),
  })
  .superRefine((o, ctx) => {
    const sx = o.width / o.logicalWidth;
    const sy = o.height / o.logicalHeight;
    if (sx !== sy) {
      ctx.addIssue({
        code: 'custom',
        path: ['width'],
        message: `upscale must be the same on both axes: width/logicalWidth = ${o.width}/${o.logicalWidth} = ${sx} but height/logicalHeight = ${o.height}/${o.logicalHeight} = ${sy}`,
      });
    } else if (!Number.isInteger(sx)) {
      ctx.addIssue({
        code: 'custom',
        path: ['width'],
        message: `upscale must be a whole number for crisp pixels: width/logicalWidth = ${o.width}/${o.logicalWidth} = ${sx}`,
      });
    }
  });

const easing = z.enum(Object.keys(EASINGS) as [Easing, ...Easing[]]);

const keyframeSchema = z.strictObject({
  time,
  x: z.number(),
  y: z.number(),
  /** Easing used to move from the previous keyframe to this one. */
  easing: easing.default('linear'),
});

/** A component entry: { id, type, ...params }. Params are validated per type by the loader. */
const componentEntry = z.looseObject({ id, type: z.string() });

const layerSchema = z.strictObject({
  id,
  /** world: moves with the camera and gets the post effects. screen: fixed overlay on top. */
  space: z.enum(['world', 'screen']).default('world'),
  /** Layer origin; its components draw relative to it. */
  x: z.number().default(0),
  y: z.number().default(0),
  /** The whole layer moves by round(−camera.x × parallax). */
  parallax: z.number().default(0),
  components: z.array(componentEntry),
});

const eventSchema = z.strictObject({
  time,
  /** Component id. */
  target: z.string(),
  action: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
});

const postEntry = z.looseObject({ type: z.string() });

export const sceneSchema = z
  .strictObject({
    version: z.literal(1),
    id,
    seed: z.number().int(),
    /**
     * per-component: each component draws from its own stream, deriveSeed(seed, id).
     * legacy-lcg: one Park–Miller stream (seeded with `seed`) shared by all components
     * in document order, for pixel-identical legacy ports.
     */
    rng: z.enum(['per-component', 'legacy-lcg']).default('per-component'),
    output: outputSchema,
    /** Named colours, referenced from params as "$name". */
    palette: z.record(id, hex).default({}),
    camera: z.strictObject({ keyframes: z.array(keyframeSchema).min(1) }),
    layers: z.array(layerSchema).min(1),
    /** Post-processing on the world, in order: [{ type, ...params }]. */
    post: z.array(postEntry).default([]),
    events: z.array(eventSchema).default([]),
  })
  .superRefine((s, ctx) => {
    const d = s.output.duration;
    s.camera.keyframes.forEach((k, i) => {
      if (k.time > d) ctx.addIssue({ code: 'custom', path: ['camera', 'keyframes', i, 'time'], message: `keyframe at ${k.time}s is beyond the scene duration (${d}s)` });
      const prev = s.camera.keyframes[i - 1];
      if (prev && k.time <= prev.time)
        ctx.addIssue({ code: 'custom', path: ['camera', 'keyframes', i, 'time'], message: `keyframe times must increase (${k.time}s follows ${prev.time}s)` });
    });
    s.events.forEach((e, i) => {
      if (e.time > d) ctx.addIssue({ code: 'custom', path: ['events', i, 'time'], message: `event at ${e.time}s is beyond the scene duration (${d}s)` });
    });
  });

export type SceneFile = z.infer<typeof sceneSchema>;
