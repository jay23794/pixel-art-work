import { Application, Container } from 'pixi.js';
import { applyCamera, type CameraConfig } from '../camera/camera.ts';
import type { SceneComponent } from './component.ts';
import { createFrameContext, type FrameContext, type Timing } from './context.ts';
import { createRng, deriveSeed, type Rng } from './random.ts';

export interface AppConfig extends Timing {
  /** Scene seed. Each component gets its own stream via deriveSeed(seed, id). */
  readonly seed: number;
  readonly camera: CameraConfig;
  readonly background?: number;
}

/** world: moves with the camera. screen: fixed overlays drawn above the world. */
export type Layer = 'world' | 'screen';

export interface AddOptions {
  /** Defaults to 'world'. */
  readonly layer?: Layer;
  /** Defaults to the component's own stream; pass one to share a stream (e.g. the legacy LCG). */
  readonly rng?: Rng;
}

export interface PixelForgeApp {
  readonly pixi: Application;
  readonly canvas: HTMLCanvasElement;
  /** Container for everything the camera sees. Filters set here apply to the whole world. */
  readonly world: Container;
  /** Builds a component and adds it on top of the ones already in its layer. */
  add<C>(component: SceneComponent<C>, config: C, options?: AddOptions): void;
  /** Updates every component for frame n and renders once. */
  renderFrame(n: number): FrameContext;
  destroy(): void;
}

export async function createApp(config: AppConfig): Promise<PixelForgeApp> {
  const pixi = new Application();
  await pixi.init({
    width: config.width,
    height: config.height,
    background: config.background ?? 0x000000,
    antialias: false,
    autoStart: false, // no ticker: frames are rendered only by renderFrame()
    preserveDrawingBuffer: true, // lets capture read the canvas after render
    resolution: 1,
  });

  // Stage order: world first, then screen-layer containers on top.
  const world = new Container();
  pixi.stage.addChild(world);

  const components: SceneComponent<never>[] = [];
  const ids = new Set<string>();

  return {
    pixi,
    canvas: pixi.canvas,
    world,
    add<C>(component: SceneComponent<C>, cfg: C, options: AddOptions = {}) {
      if (ids.has(component.id)) throw new Error(`duplicate component id "${component.id}"`);
      ids.add(component.id);
      const rng = options.rng ?? createRng(deriveSeed(config.seed, component.id));
      const container = component.build(cfg, rng, createFrameContext(0, config));
      (options.layer === 'screen' ? pixi.stage : world).addChild(container);
      components.push(component as SceneComponent<never>);
    },
    renderFrame(n) {
      const ctx = createFrameContext(n, config);
      applyCamera(world, config.camera, config.width, config.height);
      for (const c of components) c.update(ctx);
      pixi.renderer.render(pixi.stage);
      return ctx;
    },
    destroy() {
      for (const c of components) c.destroy?.();
      pixi.destroy(true, { children: true });
    },
  };
}
