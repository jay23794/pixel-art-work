import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const GOLDEN_FRAMES = [0, 24, 120, 240, 480, 720, 900] as const;
/** Golden frame sets (tests/golden/<set>/) → the scene they are rendered from (scenes/<name>.json). */
export const GOLDEN_SCENES = { v1: 'desert-lab', laboratory: 'laboratory', 'rainy-city': 'rainy-city' } as const;
export type GoldenSet = keyof typeof GOLDEN_SCENES;
export const goldenDir = (set: GoldenSet): string => join(ROOT, 'tests', 'golden', set);
export const goldenPath = (n: number, set: GoldenSet): string => join(goldenDir(set), `f${String(n).padStart(4, '0')}.png`);

/** Renders frames of one scene as PNG bytes. */
export interface FrameRenderer {
  render(n: number): Promise<Buffer>;
  close(): Promise<void>;
}
