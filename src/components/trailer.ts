import { BlurFilter, Container, Graphics } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';
import { campRoot, mix, placeAtCamp, windowLight } from './shared.ts';

/** Aluminium camper with pulsing windows/door and an additive glow. Camp group. */
export function trailer(id = 'trailer'): SceneComponent<void> {
  let root!: Container;
  let win!: Graphics;
  let door!: Graphics;
  let winGlow!: Graphics;
  return {
    id,
    build() {
      root = campRoot();
      const tr = new Graphics();
      tr.roundRect(-52, -46, 104, 42, 18).fill(0x5d6070); // body
      tr.roundRect(-50, -45, 100, 14, 12).fill(0x7c8090); // moonlit top
      for (let x = -44; x < 48; x += 8) tr.rect(x, -30, 1, 24).fill({ color: 0x3e404c, alpha: 0.8 }); // panel seams
      tr.rect(-52, -10, 104, 3).fill(0x3a3c46); // skirt
      tr.circle(-14, -2, 7).fill(0x0c0a10);
      tr.circle(-14, -2, 3).fill(0x4a4a55); // wheel
      tr.rect(52, -10, 16, 2).fill(0x2a2a32);
      tr.rect(66, -10, 2, 8).fill(0x2a2a32); // hitch & jack
      tr.rect(-6, -60, 14, 14).fill(0x45474f);
      tr.rect(-8, -62, 18, 3).fill(0x55575f); // roof vent
      tr.rect(-46, -52, 26, 2).fill(0x2a3a52);
      tr.rect(-44, -54, 22, 2).fill(0x34507a); // solar panel
      root.addChild(tr);
      win = new Graphics();
      root.addChild(win);
      door = new Graphics();
      root.addChild(door);
      winGlow = new Graphics();
      winGlow.filters = [new BlurFilter({ strength: 6, quality: 3 })];
      winGlow.blendMode = 'add';
      root.addChild(winGlow);
      return root;
    },
    update(ctx) {
      placeAtCamp(root, ctx.t);
      const lw = windowLight(ctx);
      win.clear();
      [
        [-40, -36],
        [18, -36],
      ].forEach(([x, y]) => win.roundRect(x as number, y as number, 16, 9, 2).fill(mix(0x201008, 0xffb04a, lw)));
      door.clear();
      door.rect(-2, -38, 12, 30).fill(0x2a2c34);
      door.rect(0, -36, 7, 27).fill(mix(0x1a0c06, 0xffc066, lw));
      door.rect(10, -38, 3, 30).fill(0x6c7080);
      winGlow.clear();
      [
        [-32, -32],
        [26, -32],
        [4, -22],
      ].forEach(([x, y]) => winGlow.circle(x as number, y as number, 10).fill({ color: 0xff9a3a, alpha: 0.55 * lw }));
    },
  };
}
