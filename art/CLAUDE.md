# art/ — pxl studies (Phase 1)

Code-drawn landscapes made with the pxl skill (`.claude/skills/pxl-pixel-art`). This folder is
separate from the engine: never touch `src/`, `scenes/` or `tests/` from here.

`PXL` = `node .claude/skills/pxl-pixel-art/bin/pxl.js` (run from the repo root).

## Phase 1 scope
- Landscapes and light only: sky, sun/moon, clouds, mountains, desert, sea, jungle, haze.
- No objects, vehicles or characters.

## Format and art direction
- Canvas **360×640** for every scene. Output is 3× nearest-neighbour (1080×1920).
- Follow `docs/art-direction.md` and its checklist: palette ramps, **one light direction** per
  image (state it in a comment at the top of the study), hue-shifted shading (cool shadows, warm
  lights, never black/white mixing), hard edges, Bayer 4×4 dithering only between adjacent ramp
  colours on large gradients, clusters ≥ 2×2, no jaggies, no pillow shading.
- Safe zones: top **84** px, bottom **117** px, sides **20** px hold no key detail.
  The horizon or focal point sits on a third inside the safe area.

## Palette
- `palettes.px.js` holds the palettes. Start every study with `palette("dusk")` (or `sunrise`,
  `day`, `night`). All four have the same 30 keys in the same order, so a study renders under any
  of them without changes.
- Draw only with palette keys. No `"#hex"` literals in studies.
- Glow: use `glow(keys, { ramp: n })` (palette mode), optionally with `bands` for crisp rings.
  `bands` **without** `ramp` is still colour mode (screen blend) and leaves the palette.
- Avoid colour-mode glow and `lighting()`. Use them only when a scene needs lamps, and say so in
  the study header and when presenting the image. The palette check will flag those pixels.

## Marks
- Every mark has a cause you could name: erosion gullies under ridge dips, wind ripples on sand
  at right angles to the wind, haze thickening near the ground, rim light on edges facing the sun.
- No filler noise. `noise` only on granular material (sand, gravel, rough rock), and sparse.

## Shared code (`lib/`)
- `include()` runs every file in **one shared JS context**: top-level `function` and `var`
  declarations become globals visible to every file loaded after them.
- Lib files must use only `function` and `var` at top level. A second `include()` of a file
  with a top-level `const`/`let` fails with "Identifier has already been declared"; `function`
  and `var` simply re-declare. Lib files define no assets (asset names may not be redefined).
- Paths in `include()` are relative to the including file.
- `lib/noise.px.js`: `hash2`, `vnoise1`, `vnoise2`, `fbm1`, `fbm2` (seeded, pure JS, 0..1).
- `lib/ridge.px.js`: `ridgeProfile`, `ridgePoly`, `slopeAt`, `cleanProfile`.
- `lib/dither.px.js`: `bayer4`, `ditherKey`, `rampKey` (same matrix as pxl's `dither`/`grad`).
- `lib/sky.px.js`: `skyLayer(time, { horizon })` returns the sky as scene items
  (`scene(n, opts, ...skyLayer("dusk"), ...)`); call `palette(time)` first. `skyLight(time, opts)`
  gives the sun/moon `{ x, y, r }` to light a study from. Only `dusk` and `night` are approved.

## Work loop
1. Build only the asset you're working on:
   `PXL build art/studies/<study>.px.js --out art/out --only <name>`
2. Read `art/out/_preview/<name>.png`. For exact pixels: `PXL ascii art/studies/<study>.px.js <name>`.
3. Critique against the art-direction checklist (1–8) and the pixel-art skill habits.
4. Improve. Do **at least 3 rounds** before showing the image.
5. Run `art/scripts/reel.sh <study> --still` (palette check + 3× PNG) and show that PNG.

## Still first, then motion
- Show a still image first. Animate only after the still is approved.
- Loops: **24 frames at 12 fps** (2 s cycle), `anim(name, { frames: 24, fps: 12 }, ...)`, drawn
  from `c.phase` so the loop wraps seamlessly.
- pxl rounds 1000/12 ms to 83 ms, so its GIF previews loop in 1992 ms. `reel.sh` samples by frame
  count at the nominal fps, so each cycle in the MP4 lasts exactly 2.000 s.
- Reel length is a multiple of 2 s (default 10 s): `art/scripts/reel.sh <study> [seconds]`.
  The script refuses lengths that aren't a whole number of cycles.

## Outputs
- `art/out/` (git-ignored by the root `out/` rule): `scenes/`, `anims/`, `_preview/`,
  `reels/<study>.mp4`, `reels/<study>.png`.

## Commits
- Commit after each approved step (a still, then its animation). Not before approval.
