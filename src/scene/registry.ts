import type { z } from 'zod';
import * as cactus from '../components/cactus.ts';
import * as dust from '../components/dust.ts';
import * as fade from '../components/fade.ts';
import * as generator from '../components/generator.ts';
import * as grassTufts from '../components/grassTufts.ts';
import * as ground from '../components/ground.ts';
import * as lightPool from '../components/lightPool.ts';
import * as milkyWay from '../components/milkyWay.ts';
import * as moon from '../components/moon.ts';
import { grade, noise, type PostEffectType } from '../components/post.ts';
import * as props from '../components/props.ts';
import * as ridge from '../components/ridge.ts';
import type { Actions } from '../components/shared.ts';
import * as shootingStar from '../components/shootingStar.ts';
import * as sky from '../components/sky.ts';
import * as smoke from '../components/smoke.ts';
import * as starfield from '../components/starfield.ts';
import * as stringLights from '../components/stringLights.ts';
import * as trailer from '../components/trailer.ts';
import * as vignette from '../components/vignette.ts';
import type { SceneComponent } from '../core/component.ts';

export interface ComponentType {
  /** Validates the component's params (everything except id and type). */
  readonly params: z.ZodType;
  /** Event actions this component accepts, with their params schemas. */
  readonly actions: Actions;
  create(id: string): SceneComponent<never>;
}

const entry = (m: { params: z.ZodType; actions: Actions }, create: (id: string) => SceneComponent<never>): ComponentType => ({
  params: m.params,
  actions: m.actions,
  create,
});

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
  cactus: entry(cactus, cactus.cactus),
  trailer: entry(trailer, trailer.trailer),
  generator: entry(generator, generator.generator),
  stringLights: entry(stringLights, stringLights.stringLights),
  props: entry(props, props.props),
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
