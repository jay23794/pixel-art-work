import { BlurFilter, Container, Graphics } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';
import { campRoot, mix, placeAtCamp, windowLight } from './shared.ts';

interface Puff {
  g: Graphics;
  off: number;
  dx: number;
  r: number;
  wob: number;
}

/** Smoke from the roof vent, drifting with the wind. Camp group. rng: 70 × (dx, r, wob). */
export function smoke(id = 'smoke'): SceneComponent<void> {
  let root!: Container;
  const PUFFS: Puff[] = [];
  return {
    id,
    build(_cfg, rng) {
      root = campRoot();
      const smokeC = new Container();
      smokeC.filters = [new BlurFilter({ strength: 1.5, quality: 2 })];
      root.addChild(smokeC);
      for (let i = 0; i < 70; i++) {
        const g = new Graphics();
        g.circle(0, 0, 4).fill(0xc8c2d6);
        smokeC.addChild(g);
        const off = (i / 70) * 6;
        const dx = (rng.next() - 0.5) * 22;
        const r = 0.5 + rng.next() * 1.1;
        const wob = rng.next() * 6.28;
        PUFFS.push({ g, off, dx, r, wob });
      }
      return root;
    },
    update(ctx) {
      const { t } = ctx;
      placeAtCamp(root, t);
      const lw = windowLight(ctx);
      for (const q of PUFFS) {
        const a = ((t + q.off) % 6) / 6; // age 0..1
        q.g.x = 1 + q.dx * a + a * a * 40 + Math.sin(t * 0.9 + q.wob) * 7 * a;
        q.g.y = -62 - a * 110 + Math.cos(t * 0.7 + q.wob) * 4 * a;
        q.g.scale.set((0.5 + a * 3.4) * q.r);
        q.g.alpha = Math.sin(a * Math.PI) * 0.2 * (t > 38.5 ? (40 - t) / 1.5 : 1);
        q.g.tint = mix(0x9c94b4, 0xffb070, Math.max(0, 0.6 - a) * lw * 0.6); // underlit by window light
      }
    },
  };
}
