import { Application, Container } from 'pixi.js';
import { applyCamera, evaluateCamera, parallaxX, type CameraConfig } from '../camera/camera.ts';
import type { SceneComponent } from './component.ts';
import { createFrameContext, type FrameContext, type Timing } from './context.ts';
import { createRng, deriveSeed, type Rng } from './random.ts';
import { evaluateSignals, type SignalDef } from './signals.ts';

export interface AppConfig extends Timing {
  /** Scene seed. By default each component gets its own stream via deriveSeed(seed, id). */
  readonly seed: number;
  readonly camera: CameraConfig;
  /** Evaluated in order once per frame into ctx.signals. */
  readonly signals?: readonly (readonly [string, SignalDef])[];
  readonly background?: number;
}

export interface LayerOptions {
  /** world: moves with the camera, under the world post effects. screen: fixed overlay on top. */
  readonly space: 'world' | 'screen';
  readonly x: number;
  readonly y: number;
  /** Camera-follow factor for the whole layer (see parallaxX). */
  readonly parallax: number;
}

export interface Layer {
  readonly container: Container;
  readonly options: LayerOptions;
}

export interface AddOptions {
  readonly layer: Layer;
  /** Defaults to the component's own stream; pass one to share a stream (e.g. the legacy LCG). */
  readonly rng?: Rng;
}

export interface PixelForgeApp {
  readonly pixi: Application;
  readonly canvas: HTMLCanvasElement;
  /** Everything the camera sees. Post effects go in world.filters. */
  readonly world: Container;
  /** Adds a layer on top of the existing layers in its space. */
  addLayer(options: LayerOptions): Layer;
  /** Builds a component and adds it on top of the ones already in its layer. */
  add<C>(component: SceneComponent<C>, config: C, options: AddOptions): void;
  /** Called every frame after the components update (e.g. post effects). */
  onFrame(fn: (ctx: FrameContext) => void): void;
  /** Updates everything for frame n and renders once. */
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

  // Stage order: world first, then screen layers on top.
  const world = new Container();
  pixi.stage.addChild(world);

  const signalDefs = config.signals ?? [];
  const sources = {
    camera: (t: number) => evaluateCamera(config.camera, t),
    signals: (inputs: Parameters<typeof evaluateSignals>[1]) => evaluateSignals(signalDefs, inputs),
  };
  const contextFor = (n: number) => createFrameContext(n, config, sources);
  const layers: Layer[] = [];
  const components: SceneComponent<never>[] = [];
  const frameHooks: ((ctx: FrameContext) => void)[] = [];
  const ids = new Set<string>();

  return {
    pixi,
    canvas: pixi.canvas,
    world,
    addLayer(options) {
      const container = new Container();
      container.x = options.x;
      container.y = options.y;
      (options.space === 'screen' ? pixi.stage : world).addChild(container);
      const layer = { container, options };
      layers.push(layer);
      return layer;
    },
    add<C>(component: SceneComponent<C>, cfg: C, options: AddOptions) {
      if (ids.has(component.id)) throw new Error(`duplicate component id "${component.id}"`);
      ids.add(component.id);
      const rng = options.rng ?? createRng(deriveSeed(config.seed, component.id));
      options.layer.container.addChild(component.build(cfg, rng, contextFor(0)));
      components.push(component as SceneComponent<never>);
    },
    onFrame(fn) {
      frameHooks.push(fn);
    },
    renderFrame(n) {
      const ctx = contextFor(n);
      applyCamera(world, ctx.camera, config.width, config.height);
      for (const { container, options } of layers) container.x = options.x + parallaxX(ctx.camera, options.parallax);
      for (const c of components) c.update(ctx);
      for (const fn of frameHooks) fn(ctx);
      pixi.renderer.render(pixi.stage);
      return ctx;
    },
    destroy() {
      for (const c of components) c.destroy?.();
      pixi.destroy(true, { children: true });
    },
  };
}
