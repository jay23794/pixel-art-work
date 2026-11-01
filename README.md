# PixelForge

Renders 16-bit pixel-art scenes from JSON scene descriptions into MP4 video.
Logical canvas 270×480, exported at 1080×1920 (4× nearest-neighbour), 24 fps.

> Status: project skeleton. No scene code has been ported yet — see `legacy/`.

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
| `npm run dev`       | Vite dev server at http://localhost:5173      |
| `npm run build`     | Type-check, then production build into `dist/` |
| `npm test`          | Unit tests (Vitest, `tests/**/*.test.ts`)     |
| `npm run typecheck` | `tsc --noEmit` (strict)                       |
| `npm run lint`      | ESLint (typescript-eslint, strict)            |

Playwright e2e specs go in `tests/e2e/` and run with `npx playwright test`.

## Layout

```
src/core/        app, renderer, seeded random, frame context
src/scene/       scene schema (zod), loader, factory
src/components/  scene building blocks
src/camera/      camera (static / whole-pixel pan)
src/video/       frame capture + ffmpeg encoding
scenes/          JSON scene files
legacy/          original Desert Lab files, unchanged (reference only)
tests/           unit tests
tests/golden/    reference frames for regression tests
tests/e2e/       Playwright specs
```

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
0, 24, 120, 240, 480, 720 and 900. `tests/regression.test.ts` (part of
`npm test`) renders the same frames in headless Chromium with software WebGL
and requires an exact pixel match. On failure it reports how many pixels differ.

```bash
npm run capture:golden   # re-render the golden PNGs. Only when a change to the look is approved.
```
