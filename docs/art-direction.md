# Art direction

Rules for every code-drawn image (engine scenes and lab studies). The checklist at
the end is the acceptance test for an image.

## Format

- Canvas 360×640 logical pixels, shown at 3× (1080×1920), nearest-neighbour only.
- Hard edges: no anti-aliasing, no alpha blending in the final image, no blur.
  Every final pixel is a palette colour (see the ramps below).

## Palette ramps

Each material is a ramp of 5 colours, darkest to lightest:
**deepShadow** (outlines, cast shadow, crevices) → **shadow** → **base** → **light** →
**highlight** (rim and edge highlights only, used sparingly).

Ramps are hue-shifted: shadows lean cool (blue/violet), lights lean warm
(yellow/orange). Never darken by adding black or lighten by adding white.

The lab loads this table (`lab/lib/palette.ts`). Keep its format: one ramp per row,
5 hex colours from deepShadow to highlight.

| ramp | deepShadow | shadow | base | light | highlight | use |
|---|---|---|---|---|---|---|
| night | #0b0b1e | #161a3a | #232b5c | #33427e | #4a5f9e | night sky, deep water at night |
| dusk | #2a1f4a | #5a2f5e | #9a4462 | #d9705a | #f6b06a | sunset/sunrise sky bands |
| sky | #2c4c8a | #3a6cb0 | #5590d0 | #86bce4 | #c6e4f2 | day sky |
| cloud | #5a5a86 | #8a8cb2 | #b8bad4 | #dfe0ee | #fbf6ec | clouds, mist, haze |
| sun | #b8442a | #e0743a | #f4a44a | #fcd27a | #fff4c8 | sun, glow, warm light |
| far | #2b2d52 | #3d4270 | #56608e | #7a86ac | #a9b4cc | distant mountains (atmospheric) |
| rock | #2a1f2a | #4a3438 | #6e4e48 | #96705c | #c09a78 | cliffs, boulders, near mountains |
| sand | #4a2e36 | #7a4a40 | #b07450 | #d8a066 | #f2cc8a | desert, dunes, beaches |
| grass | #12302a | #1e4a32 | #2f6a3a | #4f8e42 | #86b44e | meadows, hills |
| jungle | #0a1a1e | #10302a | #1a4a34 | #2a6a3e | #4a8e4a | dense foliage, canopy |
| water | #0e1a3a | #16305a | #1e4a7a | #2f6e9a | #5aa0c0 | sea, lakes, rivers |
| snow | #5a6a8e | #8a9ac0 | #bccae0 | #e2eaf4 | #ffffff | snow caps, foam, ice |

## Light

- **One light direction per image**, stated in the code (e.g. upper left). Every
  surface, outline highlight and shadow agrees with it.
- Faces towards the light use light/highlight. Faces away use shadow. Crevices and
  cast shadows use deepShadow.
- Cast shadows fall away from the light, in the receiving material's shadow or
  deepShadow colours.
- Light sources (sun, glow) may use the `sun` ramp on surfaces they touch: warm
  rim light on edges facing them.

## Depth (atmospheric perspective)

- Far layers: lighter, bluer (`far`, `cloud`), lower contrast (2–3 ramp steps, no
  deepShadow), less detail, no outlines.
- Near layers: full ramp, highest contrast, most detail.
- At least 3 depth planes in a landscape (far, mid, near), each readable as a
  separate silhouette.

## Outlines

- Only on foreground silhouettes, in the material's own deepShadow. Never pure black.
- 1 px wide. Remove outline pixels on edges facing the light, or replace them with
  the highlight (a lit edge).
- No outlines inside a shape: separate forms with ramp steps instead.

## Dithering

- Bayer 4×4 (ordered) only. No random noise dithering.
- Only between two **adjacent** colours of one ramp, and only for smooth gradients
  over large areas (sky, haze, sea, light falloff).
- Never on small objects, silhouettes or edges. No dithered band narrower than 4 px.

## Pixel clusters

- Shapes are built from clusters of at least 2×2 px. Avoid orphan single pixels
  (except stars, sparkles, intentional specks).
- No jaggies: lines step in regular runs (1-1, 2-2, 3-1-3…), not irregular stairs.
- No pillow shading (darkening every edge regardless of the light).

## Composition and safe zones

- Safe zones on 360×640 (Instagram): top 84 px and bottom 117 px hold no key
  detail. Keep 20 px side margins for anything important.
- Put the horizon or the focal point roughly on a third, inside the safe area.
- One clear focal point (the brightest value contrast in the image).

## Checklist

1. **Palette:** every pixel is a ramp colour; hue-shifted, no greys added.
2. **Light:** one direction; every lit edge, shadow and highlight agrees.
3. **Depth:** at least 3 planes; far is lighter/bluer/flatter, near has full contrast.
4. **Outlines:** foreground only, deepShadow colour, lit edges open or highlighted.
5. **Dithering:** Bayer 4×4, adjacent ramp colours, large gradients only.
6. **Clusters:** no orphan pixels, no jaggies, no pillow shading.
7. **Composition:** a focal point on a third; nothing key in the safe zones.
8. **Detail:** surfaces have texture at several scales (big forms, mid detail, specks).
