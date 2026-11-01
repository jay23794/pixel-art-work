import type { z } from 'zod';
import type { Keyframe } from '../camera/camera.ts';
import type { SignalDef } from '../core/signals.ts';
import { BUNDLED_SHAPE_ASSETS } from './assets.ts';
import { shapeAssetSchema, type SceneEvent, type ShapeAsset } from './primitives.ts';
import { COMPONENTS, POST_EFFECTS } from './registry.ts';
import { sceneSchema, type SceneFile } from './schema.ts';

/** A validated scene with defaults applied, colours resolved and params parsed. */
export interface SceneDef {
  readonly version: 1;
  readonly id: string;
  readonly seed: number;
  readonly rng: SceneFile['rng'];
  readonly output: SceneFile['output'] & { readonly scale: number; readonly backgroundColor: number };
  readonly camera: { readonly keyframes: readonly Keyframe[] };
  /** In evaluation order. */
  readonly signals: readonly (readonly [string, SignalDef])[];
  readonly layers: readonly LayerDef[];
  readonly post: readonly { readonly type: string; readonly params: unknown }[];
  readonly events: readonly SceneEvent[];
}

export interface LayerDef {
  readonly id: string;
  readonly space: 'world' | 'screen';
  readonly x: number;
  readonly y: number;
  readonly parallax: number;
  readonly components: readonly ComponentDef[];
}

export interface ComponentDef {
  readonly id: string;
  readonly type: string;
  /** Parsed params (defaults applied). */
  readonly params: Record<string, unknown>;
  /** Events targeting this component, in file order. */
  readonly events: readonly SceneEvent[];
}

export interface SceneIssue {
  /** JSON path, e.g. "layers[0].components[2].type". */
  readonly path: string;
  readonly message: string;
}

export class SceneValidationError extends Error {
  constructor(
    readonly issues: readonly SceneIssue[],
    source = 'scene',
  ) {
    super(`Invalid ${source}:\n${issues.map((i) => `  ${i.path || '(root)'}: ${i.message}`).join('\n')}`);
    this.name = 'SceneValidationError';
  }
}

type Path = readonly PropertyKey[];

export function formatPath(path: Path): string {
  return path.reduce<string>((s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${String(k)}` : String(k)), '');
}

const list = (names: Iterable<string>): string => [...names].sort().join(', ');

export interface LoadOptions {
  /** Name used in error messages, e.g. "scenes/desert-lab.json". */
  readonly source?: string;
  /** Shape assets by id (raw JSON). Defaults to the bundled assets/shapes/*.json. */
  readonly shapeAssets?: Readonly<Record<string, unknown>>;
}

/**
 * Parses and validates a scene (already-parsed JSON). Throws SceneValidationError
 * listing every problem with its JSON path.
 */
export function loadScene(json: unknown, options: LoadOptions = {}): SceneDef {
  const { source, shapeAssets = BUNDLED_SHAPE_ASSETS } = options;
  const issues: SceneIssue[] = [];
  const add = (path: Path, message: string): void => void issues.push({ path: formatPath(path), message });
  // Paths whose palette reference is unknown; already reported, so skip the follow-on colour-format error.
  const unresolved = new Set<string>();
  const addZod = (base: Path, error: z.ZodError): void => {
    for (const i of error.issues) {
      const path = [...base, ...i.path];
      if (!unresolved.has(formatPath(path))) add(path, i.message);
    }
  };
  const fail = (): never => {
    throw new SceneValidationError(issues, source);
  };

  const parsed = sceneSchema.safeParse(json);
  if (!parsed.success) {
    addZod([], parsed.error);
    fail();
  }
  const file = parsed.data as SceneFile;

  // "$name" → palette colour, anywhere inside params. "@name" must be a defined signal (kept as is).
  const resolve = (value: unknown, path: Path): unknown => {
    if (typeof value === 'string' && value.startsWith('@')) {
      if (!(value.slice(1) in file.signals)) {
        add(path, `unknown signal "${value}" (signals: ${list(Object.keys(file.signals)) || 'none'})`);
        unresolved.add(formatPath(path));
      }
      return value;
    }
    if (typeof value === 'string' && value.startsWith('$')) {
      const c = file.palette[value.slice(1)];
      if (c === undefined) {
        add(path, `unknown palette colour "${value}" (palette: ${list(Object.keys(file.palette)) || 'empty'})`);
        unresolved.add(formatPath(path));
      }
      return c ?? value;
    }
    if (Array.isArray(value)) return value.map((v, i) => resolve(v, [...path, i]));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, [...path, k])]));
    return value;
  };

  // Shape assets, validated once on first use.
  const assetCache = new Map<string, ShapeAsset | null>();
  const shapeAsset = (assetId: string, path: Path): ShapeAsset | null => {
    if (assetCache.has(assetId)) return assetCache.get(assetId) ?? null;
    let asset: ShapeAsset | null = null;
    const raw = shapeAssets[assetId];
    const file = `assets/shapes/${assetId}.json`;
    if (raw === undefined) {
      add(path, `unknown shape asset "${assetId}" (known: ${list(Object.keys(shapeAssets)) || 'none'})`);
    } else {
      const p = shapeAssetSchema.safeParse(raw);
      if (!p.success) for (const i of p.error.issues) issues.push({ path: `${file}:${formatPath(i.path)}`, message: i.message });
      else if (p.data.id !== assetId) issues.push({ path: `${file}:id`, message: `asset id "${p.data.id}" must match its file name "${assetId}"` });
      else asset = p.data;
    }
    assetCache.set(assetId, asset);
    return asset;
  };

  // Components: unique ids, known types, valid params.
  const declared = new Set<string>();
  const typeOf = new Map<string, string>();
  const parsedParams = new Map<string, Record<string, unknown>>();
  file.layers.forEach((layer, li) => {
    layer.components.forEach((entry, ci) => {
      const path = ['layers', li, 'components', ci];
      const { id, type, ...raw } = entry;
      if (declared.has(id)) add([...path, 'id'], `duplicate component id "${id}"`);
      declared.add(id);
      const ct = COMPONENTS[type];
      if (!ct) {
        add([...path, 'type'], `unknown component type "${type}" (known: ${list(Object.keys(COMPONENTS))})`);
        return;
      }
      typeOf.set(id, type);
      const p = ct.params.safeParse(resolve(raw, path));
      if (!p.success) {
        addZod(path, p.error);
        return;
      }
      const params = p.data as Record<string, unknown>;
      if (ct.usesShapeAsset) {
        const asset = shapeAsset(params.asset as string, [...path, 'asset']);
        if (asset) params.shapeAsset = asset;
      }
      parsedParams.set(id, params);
    });
  });

  // Events: known target, action supported by the target's type, valid params.
  const events: SceneEvent[] = [];
  file.events.forEach((e, i) => {
    const path = ['events', i];
    if (!declared.has(e.target)) {
      add([...path, 'target'], `no component with id "${e.target}"`);
      return;
    }
    const type = typeOf.get(e.target);
    if (!type) return; // its unknown type is already reported
    const actions = (COMPONENTS[type] as (typeof COMPONENTS)[string]).actions;
    const schema = actions[e.action];
    if (!schema) {
      add([...path, 'action'], `component "${e.target}" (${type}) has no action "${e.action}" (supports: ${list(Object.keys(actions)) || 'none'})`);
      return;
    }
    const p = schema.safeParse(resolve(e.params, [...path, 'params']));
    if (p.success) events.push({ time: e.time, target: e.target, action: e.action, params: p.data as Record<string, unknown> });
    else addZod([...path, 'params'], p.error);
  });

  // Post effects.
  const post = file.post.map(({ type, ...raw }, i) => {
    const path = ['post', i];
    const pt = POST_EFFECTS[type];
    if (!pt) {
      add([...path, 'type'], `unknown post effect "${type}" (known: ${list(Object.keys(POST_EFFECTS))})`);
      return { type, params: undefined };
    }
    const p = pt.params.safeParse(resolve(raw, path));
    if (!p.success) addZod(path, p.error);
    return { type, params: p.data };
  });

  if (issues.length) fail();

  const o = file.output;
  return {
    version: file.version,
    id: file.id,
    seed: file.seed,
    rng: file.rng,
    output: { ...o, scale: o.width / o.logicalWidth, backgroundColor: parseInt(o.background.slice(1), 16) },
    camera: { keyframes: file.camera.keyframes },
    signals: Object.entries(file.signals).map(([name, sig]): [string, SignalDef] => {
      if (sig.type === 'steps') return [name, { type: 'steps', keys: sig.keys }];
      const { base, pulse, envBase, env, gate } = sig;
      return [name, gate === undefined ? { type: 'curve', base, pulse, envBase, env } : { type: 'curve', base, pulse, envBase, env, gate: gate.slice(1) }];
    }),
    layers: file.layers.map((l) => ({
      id: l.id,
      space: l.space,
      x: l.x,
      y: l.y,
      parallax: l.parallax,
      components: l.components.map((c) => ({
        id: c.id,
        type: c.type,
        params: parsedParams.get(c.id) as Record<string, unknown>,
        events: events.filter((e) => e.target === c.id),
      })),
    })),
    post,
    events,
  };
}
