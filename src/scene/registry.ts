import type { z } from 'zod';
import * as dust from '../components/dust.ts';
import * as fade from '../components/fade.ts';
import * as grassTufts from '../components/grassTufts.ts';
import * as ground from '../components/ground.ts';
import * as led from '../components/led.ts';
import * as lightPool from '../components/lightPool.ts';
import * as milkyWay from '../components/milkyWay.ts';
import * as moon from '../components/moon.ts';
import { grade, noise, type PostEffectType } from '../components/post.ts';
import * as ridge from '../components/ridge.ts';
import * as shape from '../components/shape.ts';
import type { Actions } from '../components/shared.ts';
import * as shootingStar from '../components/shootingStar.ts';
import * as sky from '../components/sky.ts';
import * as smoke from '../components/smoke.ts';
import * as starfield from '../components/starfield.ts';
import * as stringLights from '../components/stringLights.ts';
import * as vignette from '../components/vignette.ts';
import * as windowLights from '../components/windowLights.ts';
import type { SceneComponent } from '../core/component.ts';

export interface ComponentType {
  /** Validates the component's params (everything except id and type). */
  readonly params: z.ZodType;
  /** Event actions this component accepts, with their params schemas. */
  readonly actions: Actions;
  /** True if the `asset` param names a shape asset; the loader validates it and attaches it as `shapeAsset`. */
  readonly usesShapeAsset?: boolean;
  create(id: string): SceneComponent<never>;
}

const entry = (
  m: { params: z.ZodType; actions: Actions },
  create: (id: string) => SceneComponent<never>,
  options: { usesShapeAsset?: boolean } = {},
): ComponentType => ({ params: m.params, actions: m.actions, create, ...options });

/** Component type name (as used in scene JSON) → component. */
export const COMPONENTS: Readonly<Record<string, ComponentType>> = {
  sky: entry(sky, sky.sky),
  milkyWay: entry(milkyWay, milkyWay.milkyWay),
  starfield: entry(starfield, starfield.starfield),
  moon: entry(moon, moon.moon),
  shootingStar: entry(shootingStar, shootingStar.shootingStar),
  ridge: entry(ridge, ridge.ridge),
  ground: entry(ground, ground.ground),
  lightPool: entry(lightPool, lightPool.lightPool),
  shape: entry(shape, shape.shape, { usesShapeAsset: true }),
  windowLights: entry(windowLights, windowLights.windowLights),
  led: entry(led, led.led),
  stringLights: entry(stringLights, stringLights.stringLights),
  smoke: entry(smoke, smoke.smoke),
  dust: entry(dust, dust.dust),
  grassTufts: entry(grassTufts, grassTufts.grassTufts),
  vignette: entry(vignette, vignette.vignette),
  fade: entry(fade, fade.fade),
};

/** Post-processing effect type name → effect. */
export const POST_EFFECTS: Readonly<Record<string, PostEffectType<never>>> = {
  grade: grade as PostEffectType<never>,
  noise: noise as PostEffectType<never>,
};
