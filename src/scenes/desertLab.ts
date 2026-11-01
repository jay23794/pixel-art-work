import { cactus } from '../components/cactus.ts';
import { dust } from '../components/dust.ts';
import { fade } from '../components/fade.ts';
import { generator } from '../components/generator.ts';
import { grade } from '../components/grade.ts';
import { grassTufts } from '../components/grassTufts.ts';
import { ground } from '../components/ground.ts';
import { lightPool } from '../components/lightPool.ts';
import { milkyWay } from '../components/milkyWay.ts';
import { moon } from '../components/moon.ts';
import { props } from '../components/props.ts';
import { ridge } from '../components/ridge.ts';
import { shootingStar } from '../components/shootingStar.ts';
import { sky } from '../components/sky.ts';
import { smoke } from '../components/smoke.ts';
import { starfield } from '../components/starfield.ts';
import { stringLights } from '../components/stringLights.ts';
import { trailer } from '../components/trailer.ts';
import { vignette } from '../components/vignette.ts';
import { createApp, type PixelForgeApp } from '../core/app.ts';
import { createLegacyRng } from '../core/random.ts';

/**
 * Desert Lab, ported from legacy/scene.html. Pixel-identical to tests/golden/legacy/.
 *
 * All components share ONE legacy LCG (seed 11), and every component only draws
 * from it in build(). The add() order below is therefore both the draw order and
 * the random-call order. Do not reorder. The calls, in sequence:
 *   1. milkyWay     260 × (x, y, alpha)
 *   2. starfield    layer 0: 90 × (x, y, ph, sp)
 *                   layer 1: 55 × (x, y, ph, sp)
 *                   layer 2: 25 × (big, x, y, ph, sp)
 *   3. ground       160 × (x, y)
 *   4. smoke        70 × (dx, r, wob)
 *   5. dust         60 × (x, y, ph, sp)
 *   6. grassTufts   16 × (x, ph)
 * Every other component uses no randomness.
 */
export async function createDesertLab(): Promise<PixelForgeApp> {
  const app = await createApp({
    width: 270,
    height: 480,
    fps: 24,
    duration: 40,
    seed: 11,
    camera: { focusY: 600 },
    background: 0x000000,
  });
  const rng = createLegacyRng(11);
  const shared = { rng };

  // ---- world (back to front) ----
  app.add(sky(), undefined, shared);
  app.add(milkyWay(), undefined, shared);
  app.add(starfield(), undefined, shared);
  app.add(moon(), undefined, shared);
  app.add(shootingStar(), undefined, shared);
  app.add(ridge('farMesa'), { color: 0x2a1838, base: 560, amp: 40, freq: 0.025, phase: 1.2, flatTop: true, parallax: 0.25 }, shared);
  app.add(ridge('midMesa'), { color: 0x1d1229, base: 585, amp: 26, freq: 0.04, phase: 3.1, flatTop: true, parallax: 0.4 }, shared);
  app.add(ridge('dunes'), { color: 0x2b1a22, base: 612, amp: 10, freq: 0.03, phase: 0.4, flatTop: false, parallax: 0.55 }, shared);
  app.add(ground(), undefined, shared);
  app.add(lightPool('doorPool'), { x: 126, y: 648, rx: 16, rxStep: 9, ry: 3, ryStep: 2, color: 0xffa040, source: 'door' }, shared);
  app.add(lightPool('bulbPool'), { x: 186, y: 648, rx: 14, rxStep: 8, ry: 2, ryStep: 1.5, color: 0xffd090, source: 'bulbs' }, shared);
  app.add(cactus('cactusLeft'), { x: 30, y: 622, h: 34, color: 0x140c16 }, shared);
  app.add(cactus('cactusRight'), { x: 238, y: 616, h: 22, color: 0x1a1020 }, shared);
  // camp group (all anchored at the camp)
  app.add(trailer(), undefined, shared);
  app.add(generator(), undefined, shared);
  app.add(stringLights(), undefined, shared);
  app.add(props(), undefined, shared);
  app.add(smoke(), undefined, shared);
  app.add(dust(), undefined, shared);
  // foreground
  app.add(ridge('fgDune'), { color: 0x0b070c, base: 742, amp: 10, freq: 0.035, phase: 2.2, flatTop: false, parallax: 1.2 }, shared);
  app.add(grassTufts(), undefined, shared);

  // ---- whole-world grade, then screen overlays ----
  const worldGrade = grade();
  app.add(worldGrade, undefined, { ...shared, layer: 'screen' });
  app.world.filters = [...worldGrade.filters];
  app.add(vignette(), undefined, { ...shared, layer: 'screen' });
  app.add(fade(), undefined, { ...shared, layer: 'screen' });

  return app;
}
