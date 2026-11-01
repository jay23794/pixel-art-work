import type { z } from 'zod';
import * as buildings from '../components/buildings.ts';
import * as ceilingLight from '../components/ceilingLight.ts';
import * as dust from '../components/dust.ts';
import * as fade from '../components/fade.ts';
import * as floor from '../components/floor.ts';
import * as grassTufts from '../components/grassTufts.ts';
import * as ground from '../components/ground.ts';
import * as led from '../components/led.ts';
import * as lightPool from '../components/lightPool.ts';
import * as milkyWay from '../components/milkyWay.ts';
import * as monitor from '../components/monitor.ts';
import * as moon from '../components/moon.ts';
import * as neonSign from '../components/neonSign.ts';
import { grade, noise, type PostEffectType } from '../components/post.ts';
import * as rain from '../components/rain.ts';
import * as reflection from '../components/reflection.ts';
import * as ridge from '../components/ridge.ts';
import type { Actions } from '../components/shared.ts';
import * as shootingStar from '../components/shootingStar.ts';
import * as sky from '../components/sky.ts';
import * as sprite from '../components/sprite.ts';
import * as smoke from '../components/smoke.ts';
import * as starfield from '../components/starfield.ts';
import * as steppedGlow from '../components/steppedGlow.ts';
import * as streetlight from '../components/streetlight.ts';
import * as stringLights from '../components/stringLights.ts';
import * as vignette from '../components/vignette.ts';
import * as wall from '../components/wall.ts';
import * as roomWindow from '../components/window.ts';
import * as windowLights from '../components/windowLights.ts';
import * as workbench from '../components/workbench.ts';
import { city } from '../components/environments/city.ts';
import { desert } from '../components/environments/desert.ts';
import { laboratory } from '../components/environments/laboratory.ts';
import type { SceneComponent } from '../core/component.ts';
import type { EnvironmentGenerator } from '../core/environment.ts';

export interface ComponentType {
  /** Validates the component's params (everything except id and type). */
  readonly params: z.ZodType;
  /** Event actions this component accepts, with their params schemas. */
  readonly actions: Actions;
  /** True if the `asset` param names an asset: the loader validates it (as `assetDef`), the factory preloads its textures (as `textures`). */
  readonly usesAsset?: boolean;
  create(id: string): SceneComponent<never>;
}

const entry = (
  m: { params: z.ZodType; actions: Actions },
  create: (id: string) => SceneComponent<never>,
  options: { usesAsset?: boolean } = {},
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
  sprite: entry(sprite, sprite.sprite, { usesAsset: true }),
  windowLights: entry(windowLights, windowLights.windowLights),
  led: entry(led, led.led),
  stringLights: entry(stringLights, stringLights.stringLights),
  smoke: entry(smoke, smoke.smoke),
  dust: entry(dust, dust.dust),
  grassTufts: entry(grassTufts, grassTufts.grassTufts),
  vignette: entry(vignette, vignette.vignette),
  fade: entry(fade, fade.fade),
  wall: entry(wall, wall.wall),
  floor: entry(floor, floor.floor),
  window: entry(roomWindow, roomWindow.roomWindow),
  workbench: entry(workbench, workbench.workbench),
  monitor: entry(monitor, monitor.monitor),
  ceilingLight: entry(ceilingLight, ceilingLight.ceilingLight),
  buildings: entry(buildings, buildings.buildings),
  neonSign: entry(neonSign, neonSign.neonSign),
  steppedGlow: entry(steppedGlow, steppedGlow.steppedGlow),
  streetlight: entry(streetlight, streetlight.streetlight),
  reflection: entry(reflection, reflection.reflection),
  rain: entry(rain, rain.rain),
};

/** Post-processing effect type name → effect. */
export const POST_EFFECTS: Readonly<Record<string, PostEffectType<never>>> = {
  grade: grade as PostEffectType<never>,
  noise: noise as PostEffectType<never>,
};

/** Environment type name (a scene's `environment.type`) → generator. */
export const ENVIRONMENTS: Readonly<Record<string, EnvironmentGenerator<never>>> = {
  city: city as EnvironmentGenerator<never>,
  desert: desert as EnvironmentGenerator<never>,
  laboratory: laboratory as EnvironmentGenerator<never>,
};
