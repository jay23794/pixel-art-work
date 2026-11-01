import { Container, Graphics } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';

interface Star {
  g: Graphics;
  ph: number;
  sp: number;
}

/**
 * Three parallax layers of twinkling stars.
 * rng per star: layers 0 and 1 → (x, y, ph, sp); layer 2 → (big, x, y, ph, sp).
 */
export function starfield(id = 'starfield'): SceneComponent<void> {
  const layers: { c: Container; stars: Star[]; f: number }[] = [];
  return {
    id,
    build(_cfg, rng, ctx0) {
      const W = ctx0.width;
      const root = new Container();
      for (let L = 0; L < 3; L++) {
        const c = new Container();
        const stars: Star[] = [];
        const count = [90, 55, 25][L] as number;
        for (let i = 0; i < count; i++) {
          const g = new Graphics();
          const big = L === 2 && rng.next() < 0.4; // short-circuit: only layer 2 draws here
          g.rect(0, 0, 1, 1).fill(0xfff4dc);
          if (big) {
            g.rect(-1, 0, 3, 1).fill({ color: 0xfff4dc, alpha: 0.5 });
            g.rect(0, -1, 1, 3).fill({ color: 0xfff4dc, alpha: 0.5 });
          }
          g.x = Math.round(rng.next() * (W + 100) - 50);
          g.y = Math.round(rng.next() * 470);
          const ph = rng.next() * 6.28;
          const sp = 1 + rng.next() * 2;
          c.addChild(g);
          stars.push({ g, ph, sp });
        }
        root.addChild(c);
        layers.push({ c, stars, f: [0.15, 0.3, 0.5][L] as number });
      }
      return root;
    },
    update(ctx) {
      const { t } = ctx;
      for (const { c, stars, f } of layers) {
        c.x = parallaxX(t, f);
        for (const s of stars) s.g.alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      }
    },
  };
}
