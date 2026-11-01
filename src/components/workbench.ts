import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

const item = z.strictObject({
  kind: z.enum(['beaker', 'flask', 'jar']),
  /** Centre x and size; the item stands on the bench top. */
  x: z.number().int(),
  width: z.number().int().min(3),
  height: z.number().int().min(3),
  /** Liquid colour and fill fraction. */
  liquid: color,
  fill: z.number().min(0).max(1),
  /** Rising bubbles in the liquid (0 = still). */
  bubbles: z.number().int().nonnegative().default(0),
});

export const params = z.strictObject({
  /** Left edge and bench-top surface y. */
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  /** Thickness of the top; legs reach y + legHeight. */
  thickness: z.number().int().positive(),
  legHeight: z.number().int().positive(),
  colors: z.strictObject({ top: color, highlight: color, edge: color, leg: color, cabinet: color, handle: color, shadow: color, glass: color }),
  /** Drawer cabinet on the right, drawers stacked top to bottom. */
  cabinet: z.strictObject({ width: z.number().int().positive(), drawers: z.number().int().positive() }),
  /** Glassware on the top, drawn in order. */
  items: z.array(item).default([]),
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;
type Item = z.infer<typeof item>;

/** Liquid surface y and left/right bounds of an item's inside at row y. */
const inside = (it: Item, top: number, y: number): [number, number] => {
  const half = Math.floor(it.width / 2);
  if (it.kind !== 'flask') return [it.x - half + 1, it.x + half - 1];
  // Flask: narrow neck in the top third, widening linearly to the base.
  const neck = top + Math.floor(it.height / 3);
  const w = y < neck ? 1 : 1 + Math.round(((y - neck) / (top + it.height - neck)) * (half - 1));
  return [it.x - w, it.x + w];
};

/** A lab bench with a drawer cabinet and glassware with bubbling liquids. */
export function workbench(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let bubbleG!: Graphics;
  return {
    id,
    build(config) {
      cfg = config;
      const { x, y, width, thickness, legHeight, colors: c } = cfg;
      const root = new Container();
      const g = new Graphics();
      const floorY = y + legHeight;

      // Shadow on the wall/floor behind, legs, lower shelf, cabinet.
      g.rect(x + 2, y + thickness, width - 4, 3).fill(c.shadow);
      for (const lx of [x + 3, x + width - cfg.cabinet.width - 6]) g.rect(lx, y + thickness, 4, legHeight - thickness).fill(c.leg);
      g.rect(x + 3, floorY - 14, width - cfg.cabinet.width - 6, 3).fill(c.leg);
      const cx = x + width - cfg.cabinet.width - 2;
      g.rect(cx, y + thickness, cfg.cabinet.width, legHeight - thickness - 2).fill(c.cabinet);
      g.rect(cx, floorY - 2, cfg.cabinet.width, 2).fill(c.shadow);
      const dh = (legHeight - thickness - 4) / cfg.cabinet.drawers;
      for (let i = 0; i < cfg.cabinet.drawers; i++) {
        const dy = Math.round(y + thickness + 1 + i * dh);
        g.rect(cx + 2, dy + Math.round(dh) - 1, cfg.cabinet.width - 4, 1).fill(c.shadow);
        g.rect(cx + Math.floor(cfg.cabinet.width / 2) - 4, dy + Math.floor(dh / 2) - 1, 8, 2).fill(c.handle);
      }
      // Top: surface, highlight, front edge.
      g.rect(x, y, width, thickness).fill(c.top);
      g.rect(x, y, width, 1).fill(c.highlight);
      g.rect(x, y + thickness - 2, width, 2).fill(c.edge);

      for (const it of cfg.items) {
        const top = y - it.height;
        const half = Math.floor(it.width / 2);
        const surface = top + Math.round(it.height * (1 - it.fill));
        for (let ry = top; ry < y; ry++) {
          const [l, r] = inside(it, top, ry);
          g.rect(l - 1, ry, 1, 1).fill(c.glass);
          g.rect(r + 1, ry, 1, 1).fill(c.glass);
          if (ry >= surface && r >= l) g.rect(l, ry, r - l + 1, 1).fill(ry === surface ? c.highlight : it.liquid);
        }
        g.rect(it.x - half, y - 1, it.width, 1).fill(c.glass);
        if (it.kind === 'jar') g.rect(it.x - half, top - 2, it.width, 2).fill(c.handle);
        if (it.kind === 'beaker') g.rect(it.x - half - 1, top, 1, 1).fill(c.glass);
      }
      root.addChild(g);
      bubbleG = new Graphics();
      root.addChild(bubbleG);
      return root;
    },
    update(ctx) {
      bubbleG.clear();
      cfg.items.forEach((it, i) => {
        const top = cfg.y - it.height;
        const surface = top + Math.round(it.height * (1 - it.fill));
        const depth = cfg.y - 1 - surface;
        if (depth < 3) return;
        for (let b = 0; b < it.bubbles; b++) {
          // Each bubble rises from the bottom to the surface, then starts again; offsets keep them apart.
          const u = (ctx.t * (0.6 + 0.15 * b) + b / it.bubbles + i * 0.37) % 1;
          const by = Math.round(cfg.y - 2 - u * depth);
          const [l, r] = inside(it, top, by);
          const bx = Math.min(r, Math.max(l, it.x + Math.round(Math.sin(ctx.t * 3 + b * 2) * ((r - l) / 3))));
          bubbleG.rect(bx, by, 1, 1).fill(cfg.colors.highlight);
        }
      });
    },
  };
}
