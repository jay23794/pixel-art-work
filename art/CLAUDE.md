# art/ — pxl studies (Phase 1)

Code-drawn landscapes made with the pxl skill (`.claude/skills/pxl-pixel-art`). This folder is
separate from the engine: never touch `src/`, `scenes/` or `tests/` from here.

`PXL` = `node .claude/skills/pxl-pixel-art/bin/pxl.js` (run from the repo root).

## Phase 1 scope
- Landscapes and light only: sky, sun/moon, clouds, mountains, desert, sea, jungle, haze.
- No objects, vehicles or characters.
- **Exception: `harbour_night`** (showcase) may have simple far buildings (dark shapes with lit
  window dots) and an interior window frame + sill (silhouette). Boats appear only as small light
  dots on the water, never as boat shapes. Still no piers, vehicles or characters.
- **Exception: `beach_night`** may have one starfish lying on the dune (requested). No palm or
  other objects.

## Times of day
- Every study is **dusk + night only**. Sunrise and day are parked (their palettes and skies exist
  but are not approved; don't use them).
- Pattern (see `studies/mountains.px.js`): one `<study>Scene(time)` function draws everything;
  `<study>_dusk` first, `<study>_night` only after dusk is approved, through the night kit:
  `var P = nightOrPalette(time, accent, legacy)`, `...P.sky(opts)`, the same drawing, `...P.end`.
  Light comes from the dusk sun; at night put the moon on the sun's side (the `moon` option) so
  the existing lighting stays correct.

## Format and art direction
- Canvas **360×640** for every scene. Output is 3× nearest-neighbour (1080×1920).
- Follow `docs/art-direction.md` and its checklist: palette ramps, **one light direction** per
  image (state it in a comment at the top of the study), hue-shifted shading (cool shadows, warm
  lights, never black/white mixing), hard edges, Bayer 4×4 dithering only between adjacent ramp
  colours on large gradients, clusters ≥ 2×2, no jaggies, no pillow shading.
- Safe zones: top **84** px, bottom **117** px, sides **20** px hold no key detail.
  The horizon or focal point sits on a third inside the safe area.

## Palette (32 colours: 6 ramps × 5 + foliage J/j)
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
- `lib/sky.px.js`: `skyLayer(time, opts)` returns the sky as scene items
  (`scene(n, opts, ...skyLayer("dusk"), ...)`); call `palette(time)` first. `skyLight(time, opts)`
  gives the sun/moon `{ x, y, r }` to light a study from. Options (defaults = the approved sky):
  `horizon` (scales the layout), `sun`/`moon: { x, y }`, `clouds: { scale, x, y, top }`,
  `motion: { clouds, twinkle }` for loops, `moon.crescent: { dx, dy }`, `stars: { maxY, density }`,
  `glow: { r, ramp }` (`r: 0` = no halo; `harbour_night` draws its own).
  `layer: "back" | "stars"` splits the sky so a loop stamps the still part once.
- `lib/breakers.px.js`: `breakers(opts)` returns breaking waves as scene items (one wave per spot
  per loop: rise, peel with a thick lip over a dark hollow, billowing whitewater that collapses
  into lace, spray downwind); `breakerWash(opts, phase)` gives the wash run-up 0..1. Techniques
  borrowed from pixelfx's wave-crash, kept hard-edged and palette-only. Used by `beach_night`.
- **Night kit** (every night scene uses it; techniques in `docs/night-notes.md`):
  - `lib/night_palette.px.js`: `nightPalette(accent)` = night_base (27) + one accent (`warm`,
    `neon`, `silver`; keys 1–5) = 32. **Accents are for light sources only** (lamps, windows,
    signs, fireflies, moon halo, lightning) and the light they throw; objects and materials use
    base colours. Legacy mode `nightPalette(accent, "night" | "jungle_night" | "harbour_night" |
    "beach_night")` keeps an old palette drawable (its keys, old colours) for ported studies; end
    the old-key drawing with a `nightRemap()` item (old colour → night colour by `NIGHT_LEGACY`,
    fails the build on anything else). Kit modules capture `nightKeys()` / `nightRoles()` at
    definition time, so they work in both modes; never write night keys as literals in a lib.
  - `lib/night_sky.px.js`: `nightSky(opts)` (gradient, stars, moon full/crescent, halo
    `glow: { r, ramp }` or `{ rings }`, clouds `{ amount, x, y, scale, top }`, motion, layer),
    `nightLight(opts)` = the moon `{ x, y, r }`, `nightOrPalette(time, accent, legacy)` for
    dusk + night studies (`{ sky(opts), end }`).
  - `lib/night_lights.px.js`: `lights({ points, pools, windows, flicker, animate })` — 5-ring
    stepped glow (radii 1, 2, 4, 7, 11), light pools, lit windows (big panes dimmer);
    `nightFlicker(id, phase, { rate: 0.03 })` (~3% of lights have one 2–6 frame burst per loop,
    seeded start); `lightBeam(level, { lift })` (moonlight shafts in the cool beam ramp).
  - `lib/night_city.px.js` `cityLights(opts)`, `lib/night_reflections.px.js` `reflections(opts)`
    (from harbour_night), `lib/night_fireflies.px.js` `fireflies(opts)` (from jungle_night).
  - Weather and sky events (items reading `c.phase`, loop-safe):
    `lib/night_rain.px.js` `rain({ angle, density, wind, ground })` (4 depths, slanted space:
    angle snaps to 1/n for regular runs); `lib/night_ripples.px.js` `ripples({ area, mask, mode })`
    (`"ring"` stepped rings that fade into dashes; `"light"` breaks up reflections);
    `lib/night_fog.px.js` `fog({ top, height, bands, role, density, amp, sway, motion, period })`
    (cool veils + a solid bottom band). `motion: "sway"` (default) sways + morphs in any loop.
    **`motion: "drift"`** moves one way by `drift` px per loop (two cross-faded copies: seamless
    at any distance): make the fog cycle the whole reel (the longest loop, 72 frames = 6 s; a
    12 s reel = 2 cycles) with `period: 180, drift: 90` (1.25 px/frame, reads as fog; 2.5 px/frame
    reads as sliding), and run faster modules inside it with `nightRepeat(item, n)`;
    `lib/night_lightning.px.js` `lightning({ frames, at, horizon, bolt })` (one strike per loop,
    `NIGHT_LIGHTNING_PATTERN`: sky +1 step on 2 frames, bolt, cooling channel, return stroke);
    `lib/night_meteor.px.js` `meteor({ from, to, frames, at, dur })` (once per loop; use a 2:1 or
    1:1 path for regular runs). `nightCool(K)` (night_lights) is the cool-step lookup shared by
    `lightBeam` and `fog`.
  - `studies/night_kit.px.js` (lights) and `studies/night_tests/*.px.js` (one per weather module,
    assets `test_<name>` / `test_<name>_loop`) are module tests, not scenes. Reel them with
    `art/scripts/reel.sh night_tests/<name> --asset test_<name>_loop`.
  - `node art/scripts/night-sheet.mjs` checks the palette; `node art/scripts/night-port-check.mjs`
    compares ported renders with `art/out/night/v1` pixel by pixel through `NIGHT_LEGACY`.
- `.claude/skills/pixelfx` (patch-gg/pixelfx, MIT) is installed as a reference for effect
  techniques (water, foam, spray, weather). Studies don't depend on it: borrow ideas, not code that
  paints with alpha or additive light.
- JS gotcha: a line starting with `[` or `(` continues the previous line. End the previous
  statement with `;` (e.g. `var stones = [];` before `[[...]].forEach(...)`).

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
  from `c.phase` so the loop wraps seamlessly. A study may use a longer cycle when its brief says
  so (`beach_night_loop`: 48 frames, 4 s).
- pxl rounds 1000/12 ms to 83 ms, so its GIF previews loop in 1992 ms. `reel.sh` samples by frame
  count at the nominal fps, so each cycle in the MP4 lasts exactly 2.000 s.
- **Lightning safety:** at most one strike per 4 s (`lightning` loops of 48+ frames, one strike
  each); the flash is the sky up **one** palette step for **≤ 3 frames**; never a full-screen
  bright flash (no white or near-white fills, ground and foreground never flash).
- pxl caps an image at 16.7 Mpx, so an anim of 360×640 is at most **72 frames** (6 s at 12 fps).
  Longer cycles don't build ("image too large").
- `reel.sh` reports a **motion budget** for loops: % of screen pixels changing per frame
  (reported, never enforced). Targets: **calm scenes 0.1–2%**; **dramatic scenes** (breaking
  waves, storms) **up to ~5%**. Near 0% is fine when a scene is meant to be subtle
  (`mountains_night`, `desert_night`: only star twinkle). Small values print with more decimals.
- Reel length is a whole number of cycles (default 10 s): `art/scripts/reel.sh <study> [seconds]`.
  The cycle is the anim's frames / fps; the script refuses other lengths. Without `--asset`, the
  MP4 is `<study>_loop` if the study has one, else `<study>`, else every anim in it; `--still`
  exports `<study>`.
- Loops of heavy scenes: build the still parts once as `_part` scenes (one per motion offset
  if they move) and `stamp` them per frame, so 24 frames don't redraw everything
  (`beach_night`: `_bn_back` behind, `_bn_trunk` in front).
- Static check: a study can define a part `_<anim>_static` (same size as the anim); every opaque
  pixel in it must be identical in all frames, or `reel.sh` fails (exit 5). Mark what must never
  move: moon disk, trunks, dunes. Leave out anything that moving parts pass in front of.

## Outputs
- `art/out/` (git-ignored by the root `out/` rule): `scenes/`, `anims/`, `_preview/`,
  `reels/<study>.mp4`, `reels/<study>.png`.

## Commits
- Commit after each approved step (a still, then its animation). Not before approval.
