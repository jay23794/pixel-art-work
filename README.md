# PixelForge

Renders 16-bit pixel-art scenes from JSON scene descriptions into MP4 video.
Logical canvas 270×480, exported at 1080×1920 (4× nearest-neighbour), 24 fps.

> Status: Desert Lab (`scenes/desert-lab.json`), Laboratory (`scenes/laboratory.json`) and Rainy City (`scenes/rainy-city.json`) render through the same engine and export to MP4.

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
| `npm run render -- <scene.json\|sequence.json>` | Export MP4 + frame-hash manifest (see Export, Sequences) |
| `npm run import -- <export> --id <id>` | Import a FrameBaker spritesheet as an asset (see Assets) |
| `npm run dev`       | Preview at http://localhost:5173 (`?scene=desert-lab&frame=N`; console: `renderFrame(n)`) |
| `npm run build`     | Type-check, then production build into `dist/` |
| `npm test`          | Unit tests (Vitest, `tests/**/*.test.ts`)     |
| `npm run typecheck` | `tsc --noEmit` (strict)                       |
| `npm run lint`      | ESLint (typescript-eslint, strict)            |
| `npm run capture:golden -- <v1\|laboratory\|rainy-city>` | Render a golden frame set; refuses to overwrite without `--update` |

Playwright e2e specs go in `tests/e2e/` and run with `npx playwright test`.

## Layout

```
src/core/        app, renderer, seeded random, frame context
src/scene/       scene schema (zod), loader, factory, component registry
src/components/  scene building blocks (+ post effects in post.ts)
src/components/environments/  environment generators (city, desert, laboratory)
src/camera/      keyframed camera, whole-pixel parallax
src/video/       MP4 export: renderer page, Playwright capture, FFmpeg encoding, CLI
scenes/          JSON scene files (composition only)
sequences/       JSON shot lists that cut scenes together into one video
assets/sprites/  sprite/animation assets (<id>.json + <id>.png)
src/assets/      asset contract, registry, preloader, cleanup, FrameBaker importer
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
| `version`, `id`, `seed` | Format version (1), scene id, RNG seed. Each component draws from its own stream, `createRng(deriveSeed(seed, id))`, so adding or removing a component never changes another's output. |
| `output` | `width`/`height` (video), `logicalWidth`/`logicalHeight` (pixel canvas), `fps`, `duration`, `background`. The upscale must be the same whole number on both axes. |
| `palette` | Named colours `"#rrggbb"`; use them anywhere in params as `"$name"` |
| `signals` | Named time-varying values, used in params as `"@name"` (see below) |
| `camera.keyframes` | `{ time, x, y, easing }`. `x` = camera position (+ right), `y` = world y at screen centre. Easing applies from the previous keyframe. |
| `environment` | Optional generator that builds the world layers: `{ type, ...config }` (see Environments). |
| `layers` | Drawn on top of the environment's layers, back to front: `{ id, space: world\|screen, x, y, parallax, components: [{ id, type, ...params }] }` |
| `post` | Ordered effects on the world: `grade`, `noise` |
| `events` | One-off moments: `{ time, target, action, params }`, e.g. `launch` (shooting star), `fadeIn`/`fadeOut` |

**Signals** are evaluated once per frame, in file order, into `ctx.signals`.
They depend only on the frame (t, n, pulse, env; audio later), so rendering
stays deterministic:

- `steps`: `{ "keys": [[0, 1], [37.2, 0]] }`. A key's value applies just after
  its time; before that, the first key's value.
- `curve`: `(base + pulse·ctx.pulse) × (envBase + env·ctx.env) × gate`. `gate`
  is an optional `"@signal"` defined above it.
- `flicker`: `{ "speed": 23, "threshold": -0.85, "dim": 0.25, "pulseAbove": 0.5 }`
  is 1 while `sin(t·speed + phase) > threshold` (or `pulse > pulseAbove`), otherwise
  `dim`. It's a faulty neon tube; use it as a curve's `gate`.

Params that take a level or power (e.g. `lightPool.level`, `dust.power`) accept
a number or `"@name"`.

**Sprites** place an asset: `{ "id": "chair", "type": "sprite", "asset": "camp-chair", "x": 70, "y": 0 }`
(`x`/`y` is where the asset's anchor lands; optional `parallax`, and for
animations `phase` and `loop`). Unknown asset ids and invalid asset files are
reported at load time.

Parallax: a layer or component with factor `p` moves by `round(-camera.x × p)`
pixels, so every layer lands on whole pixels. Component types, their params and
the actions they accept are defined next to each component (`params`, `actions`)
and listed in `src/scene/registry.ts`. Errors name the JSON path, e.g.
`layers[0].components[1].type: unknown component type "sparkle" (known: …)`.

## Environments

An environment generator (`EnvironmentGenerator` in `src/core/environment.ts`)
turns a config and its own random stream into layers of components. Those are
plain scene data, `{ id, type, ...params }`, validated exactly like hand-written
layers. Generators live in `src/components/environments/` and are listed in
`ENVIRONMENTS` in `src/scene/registry.ts`. The engine has no scene-specific code.

```json
"environment": { "type": "laboratory", "monitors": 3, "power": { "lights": "@mains" } }
```

- Generated layers are drawn first. The scene's own `layers` go on top, e.g. a vignette/fade overlay.
- Each generator has a default palette. The scene's `palette` overrides it by name.
- The generator's rng is `createRng(deriveSeed(seed, "environment:<type>"))`.
  Generated components still draw from their own per-id streams.
- Errors in generated content are reported under `environment`, e.g.
  `environment.layers[1].components[5].power`.

| Type | Config (all optional) |
| --- | --- |
| `desert` | `lights.{power, windows, bulbs, bulbGlow}`: signals that drive the camp lights (defaults `@lightsOn`, `@windowLight`, `@bulbsOn`, `@bulbGlow`) |
| `city` | `width`, `height`, `groundY`, `sign.{x,y}`, `streetlight.x`, `rain` (drop count), `levels.{neon, lamp, windows}` |
| `laboratory` | `width`, `height`, `ceilingY`, `floorY`, `window.{x,y,width,height}`, `bench.{x,y,width}`, `monitors` (0–4), `lights` (0–4), `glassware` (0–12), `faultyLight`, `power.{lights, screens}` |

The laboratory's rng picks the screen modes (`wave`, `bars`, `code`, `radar`),
monitor sizes and positions, the glassware, and which ceiling light flickers.
Its component types (`wall`, `floor`, `window`, `workbench`, `monitor`,
`ceilingLight`) can also be used directly in `layers`.

The city follows the motel and streetlight scenes of `legacy/render.py` at 2× its
135×240 canvas. Its rng lays out two rows of buildings. Component types:
`buildings` (lit windows, each lit while `floor(phase + t·rate) mod 3 ≠ 0`),
`neonSign` (tubes and a chasing arrow), `steppedGlow` (additive glow, `(1 − d)²`
rounded to `levels` = 4 rings), `streetlight` (cone and pool), `reflection` (wet
ground: darkened rows with a rippling stripe of the light's colour) and `rain`
(slanted streaks, tinted inside light cones). The banded sky is `sky` with one band
per row and `steps: 4`, which is the reference's `round(f·4)/4` gradient.
`scenes/rainy-city.json` drives the sign, its glow and its reflection from one
`flicker`-gated `@neon` signal, so they all flicker together.

## Sequences

A sequence (`sequences/<name>.json`, validated by `src/scene/sequence.ts`) plays
shots back to back in one video. Each shot shows a time range of a scene, on the
scene's own clock:

```json
{ "version": 1, "id": "tour", "shots": [
  { "scene": "desert-lab", "start": 5,  "end": 15, "transition": "fade" },
  { "scene": "laboratory", "start": 16, "end": 26, "transition": "fade" },
  { "scene": "rainy-city", "start": 30, "end": 40, "transition": { "type": "flash", "duration": 0.5 } }
] }
```

- `scene` names `scenes/<scene>.json`. The shot shows `[start, end)`, and both must
  land on a frame. Every scene in a sequence must share the size and fps.
- `transition` is how the shot is entered (default `cut`):
  - `fade` (default 1s): the previous shot fades to solid black over the first
    half, then this shot fades up over the second half. On the first shot it fades
    up from black.
  - `flash` (default 0.5s): starts solid white and eases out.
  - `{ "type", "duration" }` sets the length in seconds.
- The video is the sum of the shot lengths (`tour`: 30s). Shot frames are the
  scenes' own frames, so untouched frames are pixel-identical to each scene
  rendered alone. Transitions are blended into the captured pixels afterwards with
  integer maths (`applyOverlay`).

```bash
npm run render -- sequences/tour.json     # → out/tour.mp4 (desert → lab → city)
```

The manifest also lists each shot's output frames.

## Assets

An asset is `assets/sprites/<id>.json` plus its PNG (contract: `src/assets/contract.ts`):

```json
{ "id": "ada-walk", "type": "animation", "src": "ada-walk.png", "width": 21, "height": 47,
  "anchor": { "x": 11, "y": 24 }, "frames": [{ "x": 0, "y": 0, "duration": 1 }, …], "fps": 10,
  "defaultLayer": "camp", "tags": ["character"], "palette": ["#1a1c2c", …] }
```

- `type`: `sprite` (1 frame) or `animation` (2+ frames, needs `fps`; `duration` in steps of 1/fps).
- `anchor`: the frame point placed at the sprite's position. `palette`: the colours the image uses.
- Images are 1× pixel art with alpha 0 or 255 only (checked by `tests/assets.test.ts`).
- Every texture a scene uses is loaded (nearest-neighbour) before the scene is built,
  so frame 0 never renders without them. Animation frames are chosen with integer
  maths: `floor(n × fps / sceneFps)`.

### Importing from FrameBaker

```bash
npm run import -- "EVAL Dr Ada Volt_spritesheet.zip" --id ada-walk --tags character --layer camp
```

Accepts the export `.zip`, its extracted folder, or the `.frames.json`. Options:
`--palette <scene.json|palette.json>` (snap colours), `--scale auto|N`, `--alpha 0-255`
(threshold, default 128), `--no-trim`, `--expect WxH` (size check), `--out`, `--force`.
Cleanup (sharp): threshold alpha to 0/255 → snap to the palette → downscale to the true
pixel grid (auto-detected from pixel runs; blocks must be uniform) → trim to the bounds
shared by all frames (the anchor follows) → verify the size. Frames are written in one row.

## Export

```bash
npm run render -- scenes/desert-lab.json --out out/desert-lab.mp4 [--from N --to M]
```

`--from`/`--to` are inclusive frame numbers (default: the whole scene, 0–959 for
Desert Lab). Output: `out/desert-lab.mp4` and `out/desert-lab.hashes.json`
(sha256 of every raw frame plus a combined `digest`). Timing is printed at the end.

How it works:

1. The scene is validated in Node first (bad scenes fail before a browser starts).
2. A private Vite server (random port) serves `render.html`; headless Chromium
   (software WebGL) loads the scene through the same loader and factory as the preview.
3. For each frame the page calls `renderFrame(n)`, reads raw RGBA at logical size
   (270×480, no PNG/base64) and POSTs the bytes to the Node process, which hashes
   them and streams them to FFmpeg's stdin as `rawvideo` (with backpressure).
4. FFmpeg: `scale=1080:1920:flags=neighbor` (BT.709, tagged), `libx264 -tune
   animation -crf 16 -pix_fmt yuv420p`, `+faststart`.

Any page error, console error or FFmpeg failure stops the export with a non-zero
exit and a clear message, and the partial MP4 is removed. `tests/export.test.ts`
renders frames 0–48 twice and requires identical manifests.

## Legacy reference scene

`legacy/capture.js` and `legacy/render.py` are the original files, unchanged.
`legacy/scene.html` is the music-free **reference version** of Desert Lab that
the engine was ported from (pixel-identical up to Prompt 5b; its golden frames
are in git history before Prompt 6):

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

`tests/golden/<set>/` holds reference PNGs (270×480) of frames
0, 24, 120, 240, 480, 720 and 900: `v1` from `scenes/desert-lab.json`,
`laboratory` from `scenes/laboratory.json`, `rainy-city` from `scenes/rainy-city.json`
(see `GOLDEN_SCENES` in `scripts/golden.ts`).

`tests/regression.test.ts` (part of `npm test`) renders the same frames (through
the real loader and factory on a private Vite server) in headless Chromium with
software WebGL, and requires an exact pixel match. On failure it reports how
many pixels differ. It only reads `tests/golden/`: a missing frame fails the
test, and a final test checks that every golden file's hash and mtime are
unchanged after the run.

`tests/isolation.test.ts` proves that adding or removing a component leaves
every other component's rendered output unchanged.

```bash
npm run capture:golden -- laboratory            # writes all frames; refuses if any already exist
npm run capture:golden -- laboratory --update   # overwrite. Only when a change to the look is approved.
```
