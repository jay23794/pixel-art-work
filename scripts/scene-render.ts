import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { createRng } from '../src/core/random.ts';
import { environmentSeed } from '../src/scene/loader.ts';
import { ENVIRONMENTS } from '../src/scene/registry.ts';
import { openRenderer } from '../src/video/capture.ts';
import { ROOT, type FrameRenderer } from './golden.ts';

// Tests and golden capture render through the same renderer page as export (render.html).

/** Reads scenes/<name>.json. */
export const readScene = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(ROOT, 'scenes', `${name}.json`), 'utf8')) as Record<string, unknown>;

/**
 * The same scene with its `environment` replaced by the layers it generates (before the
 * scene's own) and the generator's default palette merged under the scene's. Lets tests
 * edit generated components as if they were hand-written. Expects a valid environment.
 */
export function inlineEnvironment(json: Record<string, unknown>): Record<string, unknown> {
  const { environment, ...scene } = json as { environment?: { type: string } } & Record<string, unknown>;
  if (!environment) return json;
  const { type, ...config } = environment;
  const gen = ENVIRONMENTS[type];
  if (!gen) throw new Error(`unknown environment "${type}"`);
  const layers = gen.generate(gen.params.parse(config), createRng(environmentSeed(scene.seed as number, type)));
  return {
    ...scene,
    palette: { ...gen.palette, ...(scene.palette as Record<string, string> | undefined) },
    layers: [...structuredClone(layers), ...((scene.layers as unknown[] | undefined) ?? [])],
  };
}

/** The renderer page, for tests that run their own browser-side code (it can import /src/… through Vite). */
export interface Harness {
  readonly page: Page;
  close(): Promise<void>;
}

export const openHarness = async (): Promise<Harness> => openRenderer();

/** Renders a scene given as (already-parsed) JSON. */
export async function openSceneJson(json: unknown): Promise<FrameRenderer> {
  const session = await openRenderer();
  try {
    await session.load(json);
  } catch (e) {
    await session.close();
    throw e;
  }
  return { render: (n) => session.png(n), close: () => session.close() };
}

/** Renders scenes/<name>.json. */
export const openScene = (name: string): Promise<FrameRenderer> => openSceneJson(readScene(name));
