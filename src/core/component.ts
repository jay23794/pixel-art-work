import type { Container } from 'pixi.js';
import type { FrameContext } from './context.ts';
import type { Rng } from './random.ts';

/** A scene building block. */
export interface SceneComponent<Config = unknown> {
  readonly id: string;
  /** Called once. Builds the display objects; all randomness comes from rng. */
  build(config: Config, rng: Rng, ctx0: FrameContext): Container;
  /** Called every frame. Must depend only on ctx and state from build(). */
  update(ctx: FrameContext): void;
  destroy?(): void;
}
