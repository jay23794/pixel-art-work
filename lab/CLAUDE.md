# Lab: visual exploration

## Purpose
Find algorithms that make beautiful, detailed pixel-art landscapes.

## Rules
- Image quality is the only acceptance test. No schema, no golden tests.
- Draw directly into a pixel buffer: `Uint8ClampedArray`, 360×640 RGBA. No PixiJS shapes.
- Follow `docs/art-direction.md`: palette ramps, light, outlines, dithering, safe zones.
- Randomness only from the seeded RNG in `lab/lib` (`rng.ts`). No `Math.random()`, no `Date.now()` in drawing code.
- After every change:
  1. save a 3× snapshot (`npm run lab:snap -- <study>`);
  2. look at it yourself;
  3. critique it against the art-direction checklist;
  4. improve it;
  5. then show the best version with your critique.
- Don't build abstractions until something is needed a third time.

## Layout
- `lab/lib/`: buffer, palette (ramps loaded from `docs/art-direction.md`), rng, noise + fBm,
  Bayer dither, ramp shading, height map → normals → light, nearest-palette lock.
- `lab/studies/*.ts`: one study per file, exporting `{ name, params, draw(buf, t, rng, params) }`.
  `params` maps a key to a slider `{ min, max, step, value }`; `draw` receives the current values.
- `lab/render.ts`: renders a study into a buffer. Used by both the page and the CLI.
- `npm run lab`: browser lab. `npm run lab:snap` / `lab:loop`: headless PNG / MP4 into `out/lab/`.
- Nothing in `lab/` may be imported by `src/`, `scenes/` or `tests/`.
