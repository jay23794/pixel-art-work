# PixelForge

Renders 16-bit pixel-art scenes from JSON scene descriptions into MP4 video.
Logical canvas 270×480, exported at 1080×1920 (4× nearest-neighbour), 24 fps.

> Status: Desert Lab renders from `scenes/desert-lab.json`, pixel-identical to the
> legacy reference. Video export (`src/video/`) is not built yet.

## Requirements

- **Node.js 20+** (developed on Node 25) and npm
- **FFmpeg** on your `PATH`; video export shells out to it
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`
  - Windows: `winget install Gyan.FFmpeg`
  - Check with: `ffmpeg -version`

## Setup

```bash
npm install
npx playwright install chromium   # headless browser for frame capture and e2e tests
```

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Preview at http://localhost:5173 (`?scene=desert-lab&frame=N`; console: `renderFrame(n)`) |
| `npm run build`     | Type-check, then production build into `dist/` |
| `npm test`          | Unit tests (Vitest, `tests/**/*.test.ts`)     |
| `npm run typecheck` | `tsc --noEmit` (strict)                       |
| `npm run lint`      | ESLint (typescript-eslint, strict)            |
| `npm run capture:golden` | Render legacy golden frames; refuses to overwrite without `-- --update` |

Playwright e2e specs go in `tests/e2e/` and run with `npx playwright test`.

## Layout

```
src/core/        app, renderer, seeded random, frame context
src/scene/       scene schema (zod), loader, factory, component registry
src/components/  scene building blocks (+ post effects in post.ts)
src/camera/      keyframed camera, whole-pixel parallax
src/video/       frame capture + ffmpeg encoding
scenes/          JSON scene files (composition only)
assets/shapes/   static drawn art as shape assets (<id>.json)
legacy/          original Desert Lab files (scene.html is the music-free reference)
tests/           unit tests
tests/golden/    reference frames for regression tests
tests/e2e/       Playwright specs
```

## Scenes

A scene is one JSON file in `scenes/`, validated by `src/scene/schema.ts`
(version 1) and the component registry. The preview loads it with
`?scene=<file name>`. Top-level fields:

| Field | Meaning |
| --- | --- |
| `version`, `id`, `seed` | Format version (1), scene id, RNG seed |
| `rng` | `per-component` (default; each component gets `deriveSeed(seed, id)`) or `legacy-lcg` (one Park–Miller stream shared in file order, for pixel-identical legacy ports) |
| `output` | `width`/`height` (video), `logicalWidth`/`logicalHeight` (pixel canvas), `fps`, `duration`, `background`. The upscale must be the same whole number on both axes. |
| `palette` | Named colours `"#rrggbb"`; use them anywhere in params as `"$name"` |
| `signals` | Named time-varying values, used in params as `"@name"` (see below) |
| `camera.keyframes` | `{ time, x, y, easing }`. `x` = camera position (+ right), `y` = world y at screen centre. Easing applies from the previous keyframe. |
| `layers` | Ordered, back to front: `{ id, space: world\|screen, x, y, parallax, components: [{ id, type, ...params }] }` |
| `post` | Ordered effects on the world: `grade`, `noise` |
| `events` | One-off moments: `{ time, target, action, params }`, e.g. `launch` (shooting star), `fadeIn`/`fadeOut` |

**Signals** are evaluated once per frame, in file order, into `ctx.signals`.
They depend only on the frame (t, n, pulse, env; audio later), so rendering
stays deterministic:

- `steps`: `{ "keys": [[0, 1], [37.2, 0]] }`. A key's value applies just after
  its time; before that, the first key's value.
- `curve`: `(base + pulse·ctx.pulse) × (envBase + env·ctx.env) × gate`. `gate`
  is an optional `"@signal"` defined above it.

Params that take a level or power (e.g. `lightPool.level`, `dust.power`) accept
a number or `"@name"`.

**Shape assets** (`assets/shapes/<id>.json`) hold static art:
`{ id, type: "shape", width, height, anchor, shapes }`. Coordinates are local
((0, 0) = top-left of the box), and `anchor` is the local point that lands on
the placing component's position. Place one with the `shape` component:
`{ "id": "chair", "type": "shape", "asset": "camp-chair", "x": 70, "y": 0 }`.
Shapes are `rect`, `roundRect`, `circle` (filled, optional `alpha` and `repeat`)
and `curve` (stroked quadratic). Colours in assets are hex. Unknown asset ids
and invalid asset files are reported at load time.

Parallax: a layer or component with factor `p` moves by `round(-camera.x × p)`
pixels, so every layer lands on whole pixels. Component types, their params and
the actions they accept are defined next to each component (`params`, `actions`)
and listed in `src/scene/registry.ts`. Errors name the JSON path, e.g.
`layers[0].components[1].type: unknown component type "sparkle" (known: …)`.

## Legacy reference scene

`legacy/capture.js` and `legacy/render.py` are the original files, unchanged.
`legacy/scene.html` is the **reference version** of Desert Lab, which the new
engine is checked against:

- no music: `pulse(t) = 0.5 + 0.5·sin(2t)`, loudness fixed at 0.5, and the
  string-light chase steps at `floor(2t)`
- minimal camera: fixed on the camp, slow horizontal parallax pan in whole pixels

To view it:

```bash
npm run dev
# open http://localhost:5173/legacy/scene.html   (draws frame 300 on load)
```

The page loads `pixi.min.js` from its own folder. The dev server serves the
npm `pixi.js` v8 browser build at that URL (see `vite.config.ts`). To see
another frame, run `renderFrame(600)` in the browser console (frame n = t n/24 s).

## Golden frames and regression test

`tests/golden/legacy/` holds reference PNGs (270×480) of frames
0, 24, 120, 240, 480, 720 and 900, rendered from `legacy/scene.html`.

`tests/regression.test.ts` (part of `npm test`) renders the same frames from
`scenes/desert-lab.json` (through the preview page on a private Vite server) in
headless Chromium with software WebGL, and requires an exact pixel match. On
failure it reports how many pixels differ. It only reads `tests/golden/`: a
missing frame fails the test, and a final test checks that every golden file's
hash and mtime are unchanged after the run.

```bash
npm run capture:golden               # writes all frames; refuses if any already exist
npm run capture:golden -- --update   # overwrite. Only when a change to the look is approved.
```
