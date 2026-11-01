import { Container, Graphics } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { lightsOn } from './shared.ts';

interface Mote {
  g: Graphics;
  x: number;
  y: number;
  ph: number;
  sp: number;
}

/** Additive dust motes drifting in the camp light. rng: 60 × (x, y, ph, sp). */
export function dust(id = 'dust'): SceneComponent<void> {
  let c!: Container;
  const DUST: Mote[] = [];
  return {
    id,
    build(_cfg, rng) {
      c = new Container();
      c.blendMode = 'add';
      for (let i = 0; i < 60; i++) {
        const g = new Graphics();
        g.rect(0, 0, 1, 1).fill(0xffd08a);
        c.addChild(g);
        const x = 90 + rng.next() * 140;
        const y = 560 + rng.next() * 90;
        const ph = rng.next() * 6.28;
        const sp = 0.3 + rng.next();
        DUST.push({ g, x, y, ph, sp });
      }
      return c;
    },
    update(ctx) {
      const { t, pulse: p } = ctx;
      const off = lightsOn(t);
      for (const d of DUST) {
        d.g.x = Math.round(d.x + Math.sin(t * d.sp + d.ph) * 6);
        d.g.y = Math.round(d.y + Math.cos(t * d.sp * 0.7 + d.ph) * 4 - ((t * 2) % 10));
        d.g.alpha = (0.2 + 0.5 * p) * (0.5 + 0.5 * Math.sin(t * 2 + d.ph)) * off;
      }
      c.x = parallaxX(t, 0.7);
    },
  };
}
