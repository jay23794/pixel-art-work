import { Sprite, Texture } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';

/** Radial darkening towards the screen edges. Screen layer, static. */
export function vignette(id = 'vignette'): SceneComponent<void> {
  return {
    id,
    build(_cfg, _rng, ctx0) {
      const W = ctx0.width,
        H = ctx0.height;
      const vc = document.createElement('canvas');
      vc.width = W;
      vc.height = H;
      const vx = vc.getContext('2d');
      if (!vx) throw new Error('vignette: 2D canvas context unavailable');
      const rg = vx.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 0.75);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(1, 'rgba(0,0,0,0.7)');
      vx.fillStyle = rg;
      vx.fillRect(0, 0, W, H);
      return new Sprite(Texture.from(vc));
    },
    update() {},
  };
}
