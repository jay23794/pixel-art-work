import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { openRenderer } from '../src/video/capture.ts';
import { ROOT, type FrameRenderer } from './golden.ts';

// Tests and golden capture render through the same renderer page as export (render.html).

/** Reads scenes/<name>.json. */
export const readScene = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(ROOT, 'scenes', `${name}.json`), 'utf8')) as Record<string, unknown>;

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
