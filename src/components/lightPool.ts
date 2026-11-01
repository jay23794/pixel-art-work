import { Graphics } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import type { FrameContext } from '../core/context.ts';
import { bulbsOn, windowLight } from './shared.ts';

export interface LightPoolConfig {
  x: number;
  y: number;
  /** Ring k (3 → 1) has radii (rx + k·rxStep, ry + k·ryStep). */
  rx: number;
  rxStep: number;
  ry: number;
  ryStep: number;
  color: number;
  /** What lights the pool: the trailer door/windows or the string lights. */
  source: 'door' | 'bulbs';
}

const alphaFor = (source: LightPoolConfig['source'], ctx: FrameContext): number =>
  source === 'door' ? 0.07 * windowLight(ctx) : 0.05 * bulbsOn(ctx.t) * (0.6 + 0.4 * ctx.pulse);

/** Soft elliptical glow on the sand, drawn under the objects that cast it. */
export function lightPool(id: string): SceneComponent<LightPoolConfig> {
  let g!: Graphics;
  let cfg!: LightPoolConfig;
  return {
    id,
    build(config) {
      cfg = config;
      g = new Graphics();
      return g;
    },
    update(ctx) {
      const alpha = alphaFor(cfg.source, ctx);
      g.clear();
      for (let k = 3; k >= 1; k--) g.ellipse(cfg.x, cfg.y, cfg.rx + k * cfg.rxStep, cfg.ry + k * cfg.ryStep).fill({ color: cfg.color, alpha });
      g.x = parallaxX(ctx.t, 0.7);
    },
  };
}
