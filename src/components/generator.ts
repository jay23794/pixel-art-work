import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, shape } from '../scene/primitives.ts';
import { drawShapes, lit, noParams, type Actions, type WithEvents } from './shared.ts';

const point = z.tuple([z.number(), z.number()]);

export const params = z.strictObject({
  body: z.array(shape),
  /** Blinks: on during odd steps of floor(t × rate), while the light is on. */
  led: z.strictObject({ x: z.number(), y: z.number(), on: color, off: color, rate: z.number().positive() }),
  cable: z.strictObject({ from: point, control: point, to: point, width: z.number().positive(), color }),
});
export const actions: Actions = { lightsOn: noParams, lightsOff: noParams };
type Config = WithEvents<z.infer<typeof params>>;

/** Generator with a blinking LED and a cable. */
export function generator(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let led!: Graphics;
  return {
    id,
    build(config) {
      cfg = config;
      const root = new Container();
      const gen = new Graphics();
      drawShapes(gen, cfg.body);
      root.addChild(gen);
      led = new Graphics();
      root.addChild(led);
      const { from, control, to, width, color: c } = cfg.cable;
      const cable = new Graphics();
      cable.moveTo(from[0], from[1]).quadraticCurveTo(control[0], control[1], to[0], to[1]).stroke({ width, color: c });
      root.addChild(cable);
      return root;
    },
    update(ctx) {
      const { led: l } = cfg;
      led.clear();
      led.rect(l.x, l.y, 1, 1).fill(Math.floor(ctx.t * l.rate) % 2 && lit(cfg.events, ctx.t) ? l.on : l.off);
    },
  };
}
