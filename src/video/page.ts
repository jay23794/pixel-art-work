// Renderer page (render.html), driven by Playwright for export and tests.
// Uses the same loader and factory as the preview.
import type { PixelForgeApp } from '../core/app.ts';
import { createScene } from '../scene/factory.ts';
import { loadScene } from '../scene/loader.ts';

export interface SceneInfo {
  readonly id: string;
  /** Logical (render) size. */
  readonly width: number;
  readonly height: number;
  /** Final video size. */
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly fps: number;
  /** Frames 0 … frameCount − 1. */
  readonly frameCount: number;
}

export interface PixelForgePage {
  /** Validates and builds a scene; resolves once everything is ready to render. */
  load(scene: unknown, source?: string): Promise<SceneInfo>;
  /**
   * Renders frames from…to (inclusive) and POSTs each one's raw RGBA pixels
   * (top-down rows, logical size) to `endpoint?n=<frame>`. Rejects on the first
   * failed POST, with the server's message.
   */
  capture(from: number, to: number, endpoint: string): Promise<void>;
  /** Renders frame n and returns it as a PNG data URL (tests and golden frames). */
  png(n: number): string;
}

declare global {
  interface Window {
    pixelforge: PixelForgePage;
  }
}

let app: PixelForgeApp | undefined;
let info: SceneInfo | undefined;

const loaded = (): { app: PixelForgeApp; info: SceneInfo } => {
  if (!app || !info) throw new Error('no scene loaded: call pixelforge.load() first');
  return { app, info };
};

window.pixelforge = {
  async load(scene, source) {
    app?.destroy();
    const def = loadScene(scene, source === undefined ? {} : { source });
    app = await createScene(def);
    document.body.appendChild(app.canvas);
    const o = def.output;
    info = {
      id: def.id,
      width: o.logicalWidth,
      height: o.logicalHeight,
      outputWidth: o.width,
      outputHeight: o.height,
      fps: o.fps,
      frameCount: Math.round(o.duration * o.fps),
    };
    return info;
  },

  async capture(from, to, endpoint) {
    const { app: a, info: i } = loaded();
    const readback = document.createElement('canvas');
    readback.width = i.width;
    readback.height = i.height;
    const ctx = readback.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.globalCompositeOperation = 'copy';
    for (let n = from; n <= to; n++) {
      a.renderFrame(n);
      ctx.drawImage(a.canvas, 0, 0);
      const rgba = ctx.getImageData(0, 0, i.width, i.height).data;
      const res = await fetch(`${endpoint}?n=${n}`, { method: 'POST', body: rgba });
      if (!res.ok) throw new Error(`frame ${n}: ${(await res.text()) || res.statusText}`);
    }
  },

  png(n) {
    const { app: a } = loaded();
    a.renderFrame(n);
    return a.canvas.toDataURL('image/png');
  },
};
