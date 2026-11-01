import { z } from 'zod';

// Asset contract: assets/sprites/<id>.json next to its image <src>.

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a colour "#rrggbb"');
const int = z.number().int();

export const assetSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'asset ids are lowercase letters, digits and "-"'),
    /** sprite: one frame. animation: two or more frames played at `fps`. */
    type: z.enum(['sprite', 'animation']),
    /** Image file next to this JSON (PNG). */
    src: z.string().regex(/^[\w.-]+\.png$/, 'expected a PNG file name next to the asset JSON'),
    /** Size of one frame in pixels. */
    width: int.positive(),
    height: int.positive(),
    /** Point in the frame that lands on the placing component's (x, y). */
    anchor: z.strictObject({ x: int, y: int }),
    /** Frame rectangles (width × height at x, y in the image); duration in steps of 1/fps. */
    frames: z.array(z.strictObject({ x: int.nonnegative(), y: int.nonnegative(), duration: int.positive().default(1) })).min(1),
    /** Playback rate of an animation (steps per second). */
    fps: z.number().positive().optional(),
    /** Layer this asset is usually placed in (a hint for tools; scenes choose the layer). */
    defaultLayer: z.string().optional(),
    tags: z.array(z.string()).default([]),
    /** Colours the image uses (opaque pixels), sorted. */
    palette: z.array(hexColor).default([]),
  })
  .superRefine((a, ctx) => {
    if (a.type === 'sprite' && a.frames.length !== 1) ctx.addIssue({ code: 'custom', path: ['frames'], message: `a sprite has exactly 1 frame (got ${a.frames.length}); use type "animation"` });
    if (a.type === 'animation' && a.frames.length < 2) ctx.addIssue({ code: 'custom', path: ['frames'], message: 'an animation needs at least 2 frames' });
    if (a.type === 'animation' && a.fps === undefined) ctx.addIssue({ code: 'custom', path: ['fps'], message: 'an animation needs fps' });
  });

export type AssetDef = z.infer<typeof assetSchema>;
