import type { z } from 'zod';
import type { Rng } from './random.ts';

/** A component entry exactly as in scene JSON: { id, type, ...params }. Colours may be "$name", levels "@name". */
export interface ComponentSpec {
  readonly id: string;
  readonly type: string;
  readonly [param: string]: unknown;
}

/** A layer entry exactly as in scene JSON (defaults are applied by the loader). */
export interface LayerSpec {
  readonly id: string;
  readonly space?: 'world' | 'screen';
  readonly x?: number;
  readonly y?: number;
  readonly parallax?: number;
  readonly components: readonly ComponentSpec[];
}

/**
 * Builds a whole environment (e.g. a desert, a laboratory) as plain scene data.
 * The loader validates its output like hand-written layers, so a generator never
 * touches PixiJS: it only decides which components go where.
 */
export interface EnvironmentGenerator<Config = unknown> {
  /** Validates the scene's `environment` block (everything except `type`). */
  readonly params: z.ZodType<Config>;
  /** Colours its components reference as "$name". The scene's own palette overrides them by name. */
  readonly palette: Readonly<Record<string, string>>;
  /** Called once per load. Deterministic: same config and rng stream → same layers. */
  generate(config: Config, rng: Rng): readonly LayerSpec[];
}
