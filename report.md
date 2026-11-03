# PixelForge: project report

_What is in `pix-art/` as of 2026-11-01 (latest commit `76cf4b1`)._

## 1. What it is

PixelForge renders 16-bit pixel-art animated scenes from JSON files into MP4 video.

- **Input:** a scene file (`scenes/*.json`) describing layers of components,
  colours, timed signals, camera moves and events. Or a sequence file
  (`sequences/*.json`) that cuts several scenes together.
- **Rendering:** PixiJS v8 draws a 270×480 logical canvas. Export runs in headless
  Chromium with software WebGL, so output matches on every machine.
- **Output:** 1080×1920 (4× nearest-neighbour), 24 fps, H.264 MP4 via FFmpeg, plus a
  JSON manifest with the sha256 of every frame.
- **Deterministic:** frame *n* is always rendered at t = *n*/24, and all randomness
  comes from seeded generators. The same file always gives the same pixels, which
  tests enforce against reference frames.

At a glance:

| | |
|---|---|
| Scenes | 3: Desert Lab, Laboratory, Rainy City (each 40s, 960 frames) |
| Sequences | 1: `tour` (desert → lab → city, 30s, 720 frames) |
| Component types | 29, plus 2 post effects |
| Environment generators | 3: `desert`, `laboratory`, `city` |
| Sprite assets | 8 |
| Source code | 5,182 lines of TypeScript in `src/` |
| Tests and tooling | 1,463 lines in `tests/` and `scripts/`; 15 Vitest files plus 1 Playwright spec |
| Reference (golden) frames | 21 PNGs: 7 per scene |
| Last full test run | 156/156 passed; typecheck, lint, build and e2e clean |

## 2. Project layout

```
pix-art/
├── CLAUDE.md             project rules (fixed decisions + working rules)
├── README.md             user documentation
├── report.md             this report
├── package.json          scripts and dependencies (single package)
├── index.html            preview page   → src/main.ts
├── render.html           renderer page  → src/video/page.ts (export and tests)
├── vite.config.ts        dev server; serves pixi.min.js for the legacy page
├── playwright.config.ts  e2e config (software WebGL)
├── eslint.config.js      typescript-eslint strict
├── tsconfig.json         strict TS, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── src/
│   ├── core/             engine: app, RNG, frame context, signals, interfaces
│   ├── scene/            schema, loader, factory, registry, sequences
│   ├── components/       all visual building blocks (+ post effects)
│   │   └── environments/ generators: desert, laboratory, city
│   ├── camera/           keyframed camera, whole-pixel parallax
│   ├── video/            export: renderer page, capture, FFmpeg, CLI
│   ├── assets/           asset contract, preloading, FrameBaker importer
│   └── main.ts           preview entry
├── scenes/               desert-lab.json, laboratory.json, rainy-city.json
├── sequences/            tour.json
├── assets/sprites/       8 assets (<id>.json + <id>.png)
├── scripts/              golden-frame capture and shared render helpers
├── tests/                Vitest suites, golden frames, fixtures, e2e
├── legacy/               the original prototype the engine was ported from
└── out/                  rendered MP4s and manifests (git-ignored)
```

## 3. Project rules (CLAUDE.md)

**Fixed decisions**
- Stack: TypeScript, PixiJS v8, Zod, Vitest, Playwright, FFmpeg; one package.
- Vertical format by default: logical 270×480, output 1080×1920 (4×), 24 fps. All
  coordinates are logical pixels.
- Deterministic: no `Math.random()`, `Date.now()` or PixiJS ticker. Randomness only via
  `src/core/random.ts`.
- Preview and export use the same rendering code.
- No audio yet, but every component gets a per-frame `ctx` so audio can be added.
- Minimal camera: static or whole-pixel pan, code only in `src/camera/`.
- Scenes are data: no scene-specific code outside `src/components/` and `scenes/*.json`.

**Working rules**
- Make the smallest change that does the job.
- Every task ends with a file list, how to run it, and test results.
- Never update golden frames unless the task says so.
- Ask when something is ambiguous.

## 4. Engine (`src/core/`)

| File | Responsibility |
|---|---|
| `app.ts` | Creates the PixiJS application (no ticker, no antialiasing, preserved drawing buffer). Manages layers (`world` or `screen` space, with parallax) and components, and renders one frame per `renderFrame(n)` call: camera → layer offsets → each component's `update(ctx)` → frame hooks → render. |
| `component.ts` | The `SceneComponent` interface: `build(config, rng, ctx0)` returns a display object once; `update(ctx)` runs every frame; optional `destroy()`. |
| `context.ts` | The per-frame `ctx`: `n`, `t = n/fps`, size, `camera`, `signals`, plus `pulse` and `env`. These two are audio stand-ins: `pulse = 0.5 + 0.5·sin(2t)`, `env = 0.5`. |
| `random.ts` | `createRng(seed)` (mulberry32) with `next`, `range`, `int`, `pick`. `deriveSeed(sceneSeed, id)` (FNV-1a + murmur3 finaliser) gives each component its own stream. |
| `signals.ts` | Named per-frame values, evaluated in order (see §6). |
| `environment.ts` | The `EnvironmentGenerator` interface: `params` (Zod), default `palette`, and `generate(config, rng)`, which returns layers of components as plain data. |

**Per-component random streams.** Each component draws from
`createRng(deriveSeed(seed, componentId))`. Adding, removing or reordering
components never changes another component's output.

## 5. Scene format (`src/scene/`)

| File | Responsibility |
|---|---|
| `schema.ts` | Zod schema for scene files (version 1): output, palette, signals, camera, environment, layers, post, events. Also checks whole-number upscale, keyframe order and times within the duration. |
| `primitives.ts` | Shared param building blocks: `color` (`"#rrggbb"`), `randomValue` (`{base, random}`), `parallax`, `signalRef` (`"@name"`), `numberOrSignal`, `SceneEvent`. |
| `loader.ts` | `loadScene(json)`: validates everything and reports every problem with its JSON path. Resolves `"$colour"` palette refs, checks `"@signal"` refs, expands the `environment` into layers, validates each component's params against its type, attaches assets and events. |
| `factory.ts` | `createScene(def)`: preloads all textures, builds layers and components in file order (the draw order), and applies post effects as world filters. |
| `registry.ts` | Name → implementation tables: `COMPONENTS` (29), `POST_EFFECTS` (2), `ENVIRONMENTS` (3). |
| `sequence.ts` | Sequence schema, validation, transition timing and the pixel overlay (see §10). |

A scene file has these top-level fields:

| Field | Meaning |
|---|---|
| `version`, `id`, `seed` | Format version, scene id, RNG seed |
| `output` | Video and logical size, fps, duration, background colour |
| `palette` | Named colours, used as `"$name"` |
| `signals` | Named time-varying values, used as `"@name"` |
| `camera.keyframes` | `{time, x, y, easing}` |
| `environment` | Optional generator `{type, ...config}` that builds the world layers |
| `layers` | Drawn on top of the environment: `{id, space, x, y, parallax, components[]}` |
| `post` | World post effects: `grade`, `noise` |
| `events` | One-off moments: `{time, target, action, params}`, e.g. `fadeIn`, `fadeOut`, `launch` |

Errors are specific, for example:
`layers[0].components[1].type: unknown component type "sparkle" (known: …)` or
`environment.power.lights: unknown signal "@generator" (signals: mains, screens)`.

## 6. Signals

Signals are evaluated once per frame into `ctx.signals`, from the frame only, so
they stay deterministic. Components accept a number or `"@signal"` for levels and
power.

| Type | Value | Used for |
|---|---|---|
| `steps` | Piecewise constant: `[[time, value], …]`; a key applies just after its time | Lights switching on/off, screens booting, lab lights stuttering on |
| `curve` | `(base + pulse·ctx.pulse) × (envBase + env·ctx.env) × gate` | Pulsing window glow, lamp brightness |
| `flicker` | 1 while `sin(t·speed + phase) > threshold` (or `pulse > pulseAbove`), else `dim` | Faulty neon tube; used as a curve's gate |

A single signal can drive several components in sync. In the city, `@neon`
drives the sign, its glow and its reflection.

## 7. Camera (`src/camera/camera.ts`)

- Keyframes `{time, x, y, easing}` with 7 easings (linear, quad and sine in/out/in-out).
  The camera holds before the first and after the last keyframe.
- `y` is the world row at the screen centre. `x` drives parallax: a layer with factor
  *p* moves by `round(-camera.x × p)`, so everything stays on whole pixels.
- Desert Lab pans slowly side to side, reproducing the legacy pan exactly. The lab and
  the city use a static camera.

## 8. Components (`src/components/`)

Each component file exports its Zod `params`, its event `actions` and a factory.
Shared helpers are in `shared.ts`: `mix` (colour blend), `lerp`, `read` (number or
signal). Components marked † are additive light (blend mode `add`).

### Sky and backdrop
| Type | What it draws | Scenes |
|---|---|---|
| `sky` | Banded vertical gradient with quantised blend steps | desert, city |
| `milkyWay` | Diagonal band of faint dots | desert |
| `starfield` | Parallax layers of twinkling stars, some cross-shaped | desert |
| `moon` | Crescent moon with layered glow | desert |
| `shootingStar` | One streak per `launch` event | desert |
| `ridge` | Hill/mesa silhouettes from summed sines, optional flat mesa tops | desert |

### Ground and environment
| Type | What it draws | Scenes |
|---|---|---|
| `ground` | Colour bands with scattered specks | desert, city |
| `grassTufts` | Swaying grass blades | desert |
| `wall` | Flat wall/ceiling: panel seams, rail, baseboard, stains | lab |
| `floor` | Checkered tiles in rows that grow towards the viewer | lab |
| `window` | Framed window: night sky, twinkling stars, lit skyline, glare, sill | lab |
| `buildings` | City blocks with window grids that switch on and off | city |

### Props and objects
| Type | What it draws | Scenes |
|---|---|---|
| `sprite` | Places a sprite or animated asset (integer frame timing) | desert |
| `workbench` | Bench, drawer cabinet, glassware with bubbling liquids | lab |
| `monitor` | Desk monitor with animated screen: oscilloscope, level bars, scrolling code or radar; scanlines, glow | lab |
| `neonSign` | Neon tubes plus a chasing diagonal arrow, on a pole | city |

### Lights and effects
| Type | What it draws | Scenes |
|---|---|---|
| `windowLights` † | Window/door panes blending off → on, with blurred glow | desert |
| `led` | One blinking indicator pixel | desert |
| `stringLights` † | Bulbs on a sagging wire with a colour chase and glow | desert |
| `lightPool` | Soft elliptical glow on the ground | desert |
| `ceilingLight` † | Fluorescent fixture, banded light cone, optional flicker | lab |
| `streetlight` † | Pole, lamp head, hard-edged cone and ground pool | city |
| `steppedGlow` † | Radial glow quantised to 4 flat rings | city |
| `reflection` † | Rippling striped reflection on wet ground | city |
| `smoke` | Rising, growing, tinted puffs; `fadeOut` action | desert |
| `dust` † | Motes drifting in the light | desert |
| `rain` | Slanted streaks; lamp-coloured inside a light cone | city |

### Screen overlays and post effects
| Type | What it does | Scenes |
|---|---|---|
| `vignette` | Radial darkening, for a screen layer | all |
| `fade` | Full-screen colour fade driven by `fadeIn`/`fadeOut` events | all |
| `grade` (post) | Brightness from base + env + pulse | desert, city |
| `noise` (post) | Film grain cycling through a set of seeds | all |

## 9. Environment generators (`src/components/environments/`)

A scene can use `"environment": {"type": …, …config}`. The generator returns
layers of ordinary components, which the loader validates like hand-written
ones. Generated layers are drawn first and the scene's own `layers` go on top.

Each generator has:
- **Default palette:** the scene's `palette` overrides it by name.
- **Own RNG stream:** `deriveSeed(seed, "environment:<type>")`.
- **Error paths:** problems are reported under `environment.…`.

| Generator | Builds | Config (all optional) | RNG decides |
|---|---|---|---|
| `desert` | Desert Lab's night desert: sky, Milky Way, stars, moon, mesas, dunes, sand, cacti, the camp (trailer, generator, LED, light pole, string lights, chair, crate, smoke), dust, foreground dune and grass. Component ids are fixed to keep each component's stream and the original pixels. | `lights.{power, windows, bulbs, bulbGlow}`: which signals drive the camp lights | nothing (its components use their own streams) |
| `laboratory` | Ceiling, panelled wall, window, tiled floor, workbench with glassware, up to 4 monitors, up to 4 ceiling lights | room size, `ceilingY`, `floorY`, `window`, `bench`, `monitors`, `lights`, `glassware`, `faultyLight`, `power.{lights, screens}` | screen modes, monitor sizes and positions, glassware (kind, size, liquid, bubbles; never overlapping monitors), which light flickers |
| `city` | Banded sky, far and near buildings, wet street, neon sign, streetlight, stepped glow, neon and lamp reflections, rain. Follows the motel and streetlight scenes of `legacy/render.py` at 2× scale. | size, `groundY`, `sign.{x,y}`, `streetlight.x`, `rain` (drop count), `levels.{neon, lamp, windows}` | building widths, heights and gaps for both rows |

## 10. Scenes and sequences

### Scenes (`scenes/`)
| Scene | Seed | Content and timing |
|---|---|---|
| `desert-lab.json` | 11 | Desert generator plus a vignette/fade overlay. Lights pulse with the stand-in beat. String lights come on at 2s and the camp switches off around 36–37s. Shooting stars at 23.45s and 32.83s. Fade in over 1.5s, fade out from 38.3s. The camera pans with eased keyframes. |
| `laboratory.json` | 7 | Laboratory generator. Lights stutter on between 0.6s and 1.2s (`mains` steps) and screens boot at 2s. Light film grain. Fade in over 1s, fade out from 38.5s. |
| `rainy-city.json` | 23 | City generator. Neon flickers (`neonFlicker` gates `neon`) and the lamp pulses. Grade and grain. Fade in over 1.2s, fade out from 38.5s. |

The preview can open any of them: `?scene=<name>&frame=<n>`.

### Sequences (`sequences/`)
A sequence plays shots back to back. Each shot is a scene, a `start`/`end` range on
that scene's own clock, and a transition:

| Transition | Effect (default length) |
|---|---|
| `cut` | Hard switch (default) |
| `fade` | The previous shot dips to solid black, then this shot fades up (1s total) |
| `flash` | This shot starts solid white and eases out (0.5s) |

Shot frames are the scenes' own frames, so untouched frames are pixel-identical to
rendering each scene alone. Transitions are blended into captured pixels with
integer maths. Validation covers unknown scenes, times beyond the scene or off the
frame grid, end before start, scenes with different size/fps, and shots too short
for their transitions.

`tour.json`:

| Output frames | Scene range | Transition in |
|---|---|---|
| 0–239 | desert-lab 5–15s | fade up from black |
| 240–479 | laboratory 16–26s | fade through black |
| 480–719 | rainy-city 30–40s | white flash |

## 11. Assets (`assets/sprites/`, `src/assets/`)

Each asset is `<id>.json` plus `<id>.png`, following the contract in `contract.ts`:
- `type`: `sprite` (1 frame) or `animation` (2+ frames, needs `fps`)
- `width`, `height`, `anchor` (the point placed at the sprite's x/y)
- `frames` with durations
- `tags`, `defaultLayer`, `palette` (the colours used)

Images are 1× pixel art with binary alpha.

| Asset | Type | Size | Notes |
|---|---|---|---|
| `trailer` | sprite | 120×67 | Desert camp trailer (13 colours) |
| `generator` | sprite | 30×12 | Camp generator |
| `light-pole` | sprite | 2×54 | String-light pole |
| `camp-chair` | sprite | 10×17 | |
| `crate` | sprite | 12×8 | |
| `saguaro-tall`, `saguaro-short` | sprite | 14×34, 14×23 | Cacti |
| `ada-walk` | animation | 21×47, 8 frames at 10 fps | Character imported from FrameBaker; a sample, not used in a scene yet |

| File | Responsibility |
|---|---|
| `registry.ts` | Finds bundled assets through Vite; Node code can supply assets read from disk instead |
| `preload.ts` | Loads every texture a scene uses (nearest-neighbour) before frame 0 and cuts the frames |
| `importer.ts`, `import-cli.ts` | `npm run import`: turns a FrameBaker spritesheet export (`.zip`, folder or `.frames.json`) into an asset |
| `cleanup.ts` | Uses sharp to: threshold alpha to 0/255 → snap colours to a palette → detect and undo upscaling → trim to the shared bounds (the anchor follows) → verify the size |
| `zip.ts` | Minimal ZIP reader (stored and deflated entries) for FrameBaker exports |

## 12. Video export (`src/video/`)

| File | Responsibility |
|---|---|
| `render.ts` | `renderVideo()`: validates the scene or sequence in Node first, lays out the output frames, then streams them to FFmpeg and writes the hash manifest. Removes the partial MP4 on failure. |
| `capture.ts` | Starts a private Vite server on a random port and drives `render.html` in headless Chromium (SwiftShader WebGL). Raw RGBA frames are POSTed back with backpressure. The first page or console error stops the run. |
| `page.ts` | Browser side: `load(scene)`, `capture(from, to)`, `png(n)`. Uses the same loader and factory as the preview. |
| `ffmpeg.ts` | `rawvideo` RGBA in → `scale=1080:1920:flags=neighbor` (BT.709, tagged) → libx264 `-tune animation -crf 16`, yuv420p, `+faststart` |
| `cli.ts` | `npm run render -- <scene.json\|sequence.json> [--out] [--from N] [--to M]`; prints timing and per-shot frame ranges |

Speed: about 33–34 ms per frame (render, readback and encode). Rendered files in `out/`:
`desert-lab.mp4`, `laboratory.mp4`, `rainy-city.mp4` (40s each) and `tour.mp4` (30s),
each with a `.hashes.json` manifest.

## 13. Preview

`npm run dev` serves `index.html` → `src/main.ts`. It loads any `scenes/*.json` with
`?scene=<name>`, draws `?frame=<n>` (default 300), and exposes `renderFrame(n)` in the
console. It uses the same loader and factory as export.

## 14. Scripts (`scripts/`)

| File | Purpose |
|---|---|
| `capture-golden.ts` | `npm run capture:golden -- <v1\|laboratory\|rainy-city>`: renders the 7 golden frames of a set. Refuses to overwrite without `--update`. |
| `golden.ts` | Golden frame numbers (0, 24, 120, 240, 480, 720, 900), the set → scene map (`v1` → desert-lab), paths |
| `scene-render.ts` | Test helpers: open a renderer for a scene, read scene JSON, `inlineEnvironment()` (writes a scene's generated layers out as hand-written ones) |

## 15. Tests (`tests/`)

| File | What it checks |
|---|---|
| `regression.test.ts` | All 21 golden frames match exactly (pixel count reported on failure); the run never modifies `tests/golden/` |
| `isolation.test.ts` | Adding or removing a component leaves every other component's pixels unchanged; a different seed does change them |
| `scene.test.ts` | Desert Lab loads correctly (order, palette, signals, assets, defaults, events, post; generator output equals the written-out layers); invalid scenes report the right path and message |
| `environment.test.ts` | Generators: valid palettes, signal wiring, palette overrides, seed determinism, config changes structure, glassware never overlaps monitors, the rain cone matches the lamp cone; error paths; engine folders contain no scene-specific names |
| `sequence.test.ts` | Timeline layout, transition defaults, exact fade/flash amounts, the integer overlay, validation errors. Renders the full tour MP4: 720 frames, untouched frames equal each scene's goldens, solid black and white frames at the transitions, re-render identical. |
| `signals.test.ts` | `steps`, `curve` and `flicker` match the legacy formulas on every frame |
| `camera.test.ts` | Keyframe interpolation, easings, whole-pixel parallax; the desert camera reproduces the legacy pan on every frame |
| `context.test.ts` | `t = n/fps`, pulse/env stand-ins, purity, input validation |
| `random.test.ts` | RNG repeatability, ranges, uniformity, `deriveSeed` separation |
| `sprite.test.ts` | Integer animation timing (phase, loop, durations) and rendering of an animated asset |
| `assets.test.ts` | Every bundled asset meets the contract: image matches frames, binary alpha, palette equals the colours used |
| `cleanup.test.ts` | Grid detection, alpha threshold, palette snap, trim and anchor, size check |
| `importer.test.ts` | Imports real FrameBaker fixtures (`tests/fixtures/framebaker/*.zip`), palette snapping, refuses to overwrite, CLI behaviour |
| `export.test.ts` | Two renders give identical manifests; exported frames equal the goldens (export = preview); MP4 format; clear errors for a bad range, missing FFmpeg, missing scene |
| `placeholder.test.ts` | Test-runner check |
| `e2e/legacy-scene.spec.ts` | Playwright: the legacy page loads and renders a varied frame |

Golden frames live in `tests/golden/v1/` (desert), `tests/golden/laboratory/` and
`tests/golden/rainy-city/`.

## 16. Legacy reference (`legacy/`)

The original prototype the engine was ported from. It's kept unchanged and only used as a reference:

| File | What |
|---|---|
| `scene.html` | Music-free hand-coded Desert Lab in one HTML file (PixiJS). The engine reproduced it pixel for pixel up to Prompt 5b; the dev server provides its `pixi.min.js`. |
| `capture.js` | Playwright script that saved its frames as PNGs |
| `render.py` | NumPy/PIL renderer with five scenes (dusk highway, neon motel, rain on a windshield, streetlight in rain, night drive). It drove the music-synced original and was the reference for the Rainy City effects. It was never run in this project. |

## 17. How to run

```bash
npm install && npx playwright install chromium        # one-time; FFmpeg must be on PATH
npm run dev                                           # preview: http://localhost:5173/?scene=laboratory&frame=480
npm run render -- scenes/rainy-city.json              # one scene → out/rainy-city.mp4
npm run render -- sequences/tour.json                 # desert → lab → city → out/tour.mp4
npm run import -- export.zip --id my-sprite           # FrameBaker export → assets/sprites/
npm test                                              # all Vitest suites (goldens, export, sequence…)
npx playwright test                                   # e2e
npm run typecheck && npm run lint && npm run build
```

## 18. History

| Commit | Milestone |
|---|---|
| `fc3b8d6`, `51ebd23`, `bde235c` | Project start; legacy frames |
| `b4fbc0e` | Prompt 4: Desert Lab components ported from the legacy page |
| `4278860` | Prompt 5: Scene JSON schema v1 with path-specific errors |
| `270de9f` | Prompt 5b: Signals and shape assets |
| `ef1796c` | Prompt 6: Per-component RNG streams; the v1 golden frames |
| `d044dc0` | Prompt 7: Deterministic MP4 export |
| `0a630d7` | Prompt 8: Asset system: sprites, preloader, cleanup, FrameBaker importer |
| `76cf4b1` | Environment generators (desert moved into one) and the Laboratory; Rainy City and its effects plus the `flicker` signal; sequences with cut/fade/flash and the `tour` MP4 |

## 19. Known gaps and caveats

- **No sequence preview.** The dev preview shows single scenes only. A sequence
  preview should reuse the export's transition code, as CLAUDE.md requires.
- **City golden frames barely test film grain.** The city's grain cycles its seed
  every 8 frames, and 6 of its 7 golden frames are multiples of 8. They land on seed 0
  and appear to show no grain; only frame 900 does. Fixing it changes the look and
  needs approved new goldens.
- **No audio yet.** `ctx.pulse` and `ctx.env` are time-based stand-ins, so the
  beat-synced effects from the legacy renderer pulse smoothly instead.
- **Camera:** only the desert pans; the lab and city are static. No vertical moves or zoom.
- **`ada-walk`** is imported and tested but not placed in any scene.
