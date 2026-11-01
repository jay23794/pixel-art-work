import { z } from 'zod';
import { formatPath, loadScene, SceneValidationError, type SceneDef, type SceneIssue } from './loader.ts';

// A sequence: shots played back to back, each a time range of a scene (on the
// scene's own clock), entered with a transition. Every shot frame is the scene's
// own frame (t = n / fps), so it is pixel-identical to rendering the scene alone;
// transitions are applied afterwards to the captured pixels (applyOverlay).

const id = z.string().regex(/^[A-Za-z][\w-]*$/, 'ids start with a letter and use letters, digits, "_" or "-"');
const time = z.number().nonnegative();

export const TRANSITIONS = ['cut', 'fade', 'flash'] as const;
export type TransitionType = (typeof TRANSITIONS)[number];
/** Default seconds. fade: half fading the previous shot to black, half fading this one up. flash: white decaying to clear. */
const DEFAULT_DURATION: Record<TransitionType, number> = { cut: 0, fade: 1, flash: 0.5 };

export interface Transition {
  readonly type: TransitionType;
  readonly duration: number;
}

const transitionType = z.enum(TRANSITIONS);
/** "cut" | "fade" | "flash", or { type, duration } to set the length in seconds. */
const transitionSchema = z
  .union([transitionType.transform((type) => ({ type })), z.strictObject({ type: transitionType, duration: z.number().positive().optional() })])
  .transform((t): Transition => ({ type: t.type, duration: t.type === 'cut' ? 0 : ('duration' in t && t.duration !== undefined ? t.duration : DEFAULT_DURATION[t.type]) }));

const shotSchema = z.strictObject({
  /** Scene name: scenes/<scene>.json. */
  scene: id,
  /** Seconds on the scene's clock; the shot shows [start, end). Both must land on a frame. */
  start: time,
  end: time,
  /** How this shot is entered (on the first shot: from black for fade). */
  transition: transitionSchema.prefault('cut'),
});

export const sequenceSchema = z.strictObject({
  version: z.literal(1),
  id,
  shots: z.array(shotSchema).min(1),
});

export type SequenceFile = z.infer<typeof sequenceSchema>;

export interface ShotDef {
  readonly scene: string;
  readonly start: number;
  readonly end: number;
  readonly transition: Transition;
  /** The validated scene and its raw JSON (what the renderer page loads). */
  readonly def: SceneDef;
  readonly json: unknown;
  /** Scene frames shown: from (inclusive) … to (exclusive). */
  readonly sceneFrom: number;
  readonly sceneTo: number;
  /** First output frame of this shot. */
  readonly outFrom: number;
}

export interface SequenceDef {
  readonly id: string;
  /** Shared by every shot's scene (checked). */
  readonly output: SceneDef['output'];
  readonly shots: readonly ShotDef[];
  readonly frameCount: number;
}

export interface SequenceLoadOptions {
  readonly source?: string;
  /** Scene JSON by name (scenes/<name>.json). */
  readonly scenes: Readonly<Record<string, unknown>>;
  /** Passed through to loadScene. */
  readonly assets?: Readonly<Record<string, unknown>>;
}

/** Frames a transition takes inside the shot it enters (in) and at the end of the previous shot (out). */
export function transitionFrames(t: Transition, fps: number): { in: number; out: number } {
  if (t.type === 'cut') return { in: 0, out: 0 };
  if (t.type === 'flash') return { in: Math.max(1, Math.round(t.duration * fps)), out: 0 };
  const half = Math.max(1, Math.round((t.duration * fps) / 2));
  return { in: half, out: half };
}

/** Output settings every scene in a sequence must share. */
const SHARED = ['width', 'height', 'logicalWidth', 'logicalHeight', 'fps'] as const;

/** Validates a sequence and the scenes it uses. Throws SceneValidationError listing every problem with its path. */
export function loadSequence(json: unknown, options: SequenceLoadOptions): SequenceDef {
  const issues: SceneIssue[] = [];
  const add = (path: readonly PropertyKey[], message: string): void => void issues.push({ path: formatPath(path), message });
  const fail = (): never => {
    throw new SceneValidationError(issues, options.source ?? 'sequence');
  };

  const parsed = sequenceSchema.safeParse(json);
  if (!parsed.success) {
    for (const i of parsed.error.issues) add(i.path, i.message);
    fail();
  }
  const file = parsed.data as SequenceFile;

  // Each scene is validated once; its errors are reported under its own file.
  const scenes = new Map<string, SceneDef | null>();
  const sceneDef = (name: string, path: readonly PropertyKey[]): SceneDef | null => {
    if (scenes.has(name)) return scenes.get(name) ?? null;
    let def: SceneDef | null = null;
    const raw = options.scenes[name];
    if (raw === undefined) add(path, `unknown scene "${name}" (known: ${Object.keys(options.scenes).sort().join(', ') || 'none'})`);
    else
      try {
        def = loadScene(raw, { source: `scenes/${name}.json`, ...(options.assets ? { assets: options.assets } : {}) });
      } catch (e) {
        if (!(e instanceof SceneValidationError)) throw e;
        for (const i of e.issues) issues.push({ path: `scenes/${name}.json:${i.path}`, message: i.message });
      }
    scenes.set(name, def);
    return def;
  };

  let first: SceneDef | undefined;
  let outFrom = 0;
  const shots: ShotDef[] = [];
  file.shots.forEach((s, i) => {
    const path = ['shots', i];
    const def = sceneDef(s.scene, [...path, 'scene']);
    if (!def) return;
    const o = def.output;
    first ??= def;
    const mismatch = SHARED.filter((k) => o[k] !== (first as SceneDef).output[k]);
    if (mismatch.length)
      add([...path, 'scene'], `scene "${s.scene}" has a different ${mismatch.map((k) => `${k} (${o[k]} vs ${(first as SceneDef).output[k]})`).join(', ')} than "${(first as SceneDef).id}"; every shot must share them`);
    const onFrame = (key: 'start' | 'end'): number => {
      const f = s[key] * o.fps;
      if (Math.abs(f - Math.round(f)) > 1e-6) add([...path, key], `${s[key]}s is not on a frame (multiples of 1/${o.fps} s)`);
      return Math.round(f);
    };
    const sceneFrom = onFrame('start'),
      sceneTo = onFrame('end');
    if (s.end > o.duration) add([...path, 'end'], `${s.end}s is beyond the scene duration (${o.duration}s)`);
    if (sceneTo <= sceneFrom) add([...path, 'end'], `end (${s.end}s) must be after start (${s.start}s)`);
    shots.push({ scene: s.scene, start: s.start, end: s.end, transition: s.transition, def, json: options.scenes[s.scene], sceneFrom, sceneTo, outFrom });
    outFrom += sceneTo - sceneFrom;
  });

  // A shot must fit its own entry transition plus the fade-out the next shot's fade takes from it.
  shots.forEach((s, i) => {
    const fps = s.def.output.fps;
    const length = s.sceneTo - s.sceneFrom;
    const used = transitionFrames(s.transition, fps).in + (shots[i + 1] ? transitionFrames((shots[i + 1] as ShotDef).transition, fps).out : 0);
    if (length > 0 && used > length) add(['shots', i], `shot is ${length} frames but its transitions need ${used}`);
  });

  if (issues.length || !first) fail();
  return { id: file.id, output: (first as SceneDef).output, shots, frameCount: outFrom };
}

export interface Overlay {
  /** 0xRRGGBB painted over the frame. */
  readonly color: number;
  /** 0 = untouched … 1 = solid colour. */
  readonly amount: number;
}

/** The transition overlay on frame k (0-based) of shot i, or undefined when the frame is untouched. */
export function overlayAt(seq: SequenceDef, i: number, k: number): Overlay | undefined {
  const shot = seq.shots[i];
  if (!shot) throw new RangeError(`no shot ${i}`);
  const fps = seq.output.fps;
  const length = shot.sceneTo - shot.sceneFrom;
  const enter = transitionFrames(shot.transition, fps).in;
  // Entering: fade up from black (reaching clear on frame `enter`), or a white flash easing out.
  if (k < enter) {
    if (shot.transition.type === 'flash') return { color: 0xffffff, amount: (1 - k / enter) ** 2 };
    return { color: 0x000000, amount: (enter - k - 1) / enter };
  }
  // Leaving into a fade: down to solid black on this shot's last frame.
  const next = seq.shots[i + 1];
  const leave = next ? transitionFrames(next.transition, fps).out : 0;
  if (k >= length - leave) return { color: 0x000000, amount: (k - (length - leave) + 1) / leave };
  return undefined;
}

/** Paints an overlay onto RGBA pixels in place (alpha untouched). Integer maths, so it is the same everywhere. */
export function applyOverlay(rgba: Uint8Array, o: Overlay): void {
  if (o.amount <= 0) return;
  const a = Math.round(Math.min(1, o.amount) * 256);
  const rgb = [o.color >> 16, (o.color >> 8) & 255, o.color & 255] as const;
  for (let p = 0; p < rgba.length; p += 4)
    for (let c = 0; c < 3; c++) {
      const v = rgba[p + c] as number;
      rgba[p + c] = (v * (256 - a) + (rgb[c] as number) * a + 128) >> 8;
    }
}
