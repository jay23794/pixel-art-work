---
name: night-artist
description: Make a new pixel-art NIGHT scene for PixelForge (art/ studies, 360×640, pxl) in 1–2 rounds from a short brief, using the night kit in art/lib/ (nightPalette, nightSky, lights, reflections, cityLights, fireflies, rain, ripples, fog, lightning, meteor). Use first for any night scene, night variant, or night weather/light effect — before writing any drawing code. Covers the workflow, the kit's options, a recipe per approved night scene, moods, and the night lighting rules.
---

# Night artist

You make night scenes by **composing the night kit**, not by inventing new drawing code. Every
approved night scene (mountains, desert, sea, jungle, harbour, beach) is built from the same
modules; a new scene should be too. Aim: an approvable still in **1–2 rounds**.

Read, in this order, only what the step needs:
- `rules.md` — the night lighting rules and every lesson so far. **Read it first, every time.**
- `recipes.md` — one recipe per approved scene. Start from the closest one.
- `moods.md` — mood words → concrete choices.
- `kit.md` — every module's options, good ranges and bad values.
Project rules still apply: `CLAUDE.md`, `art/CLAUDE.md`, `docs/art-direction.md`.

## Workflow

1. **Read the brief.** Write down, in the study header comment: subject, mood words, the one
   focal point, light sources (the moon always; any lamps/windows/fireflies), weather, motion.
   Objects need an explicit exception in `art/CLAUDE.md` (Phase 1: landscapes and light only);
   add one line there for anything the brief allows (e.g. "a jetty and a lamp post").
2. **Pick the closest recipe** (`recipes.md`) and copy its skeleton: horizon, moon placement,
   layers, which modules, loop length. Adjust, don't start blank.
3. **Choose the palette:** `nightPalette(accent)` = night_base + **one** accent.
   `warm` for lamps, windows, fireflies, fire; `neon` for signs; `silver` when the moon is the
   only light (halo, sheen, lightning). Accents only on light sources (rules.md).
4. **Compose with the kit** (`kit.md`), back to front:
   `nightSky` → far terrain (haze/sky keys, low contrast) → mid terrain → water + `reflections`
   → `fog` → near terrain + objects → `lights` → weather (`rain`, `ripples`) → foreground.
   Draw terrain yourself with `ridge.px.js` / `dither.px.js` and **night keys via `nightKeys()`**
   (never literal letters in lib code). Moon = key light: put it on the side the faces are lit
   from, and light rims/edges toward it.
5. **Render the still:**
   `node .claude/skills/pxl-pixel-art/bin/pxl.js build art/studies/<study>.px.js --out art/out --only <study>`
   then read `art/out/_preview/<study>.png` (zoom into crops with a quick pngjs script when
   detail matters: 2–4× crops of the focal point, the light, the water).
6. **Critique** with the `pixel-art` skill and the checklist in `docs/art-direction.md` (1–8),
   plus the night checks in `rules.md`: one key light, one accent, focal point = brightest value
   contrast, nothing key in the safe zones (top 84, bottom 117, sides 20), clusters ≥ 2×2,
   regular stairs, no pillow shading, dithering only on large gradients.
7. **Fix** the worst problem first, re-render. Stop when the checklist passes. Count rounds:
   a round = one render you critique. Target ≤ 2.
8. **Loop:** add the `anim` (24 f / 2 s default; 48 f for rare events; ≤ 72 f — pxl's cap). Moving
   modules read `c.phase`; long cycles (fog `drift`) wrap fast modules in `nightRepeat(item, n)`.
   Define `_<anim>_static` (what never moves: moon disk, terrain, objects).
9. **Checks:** `art/scripts/reel.sh <study> <seconds> [--asset <anim>]` (palette, static check,
   motion budget) and `art/scripts/reel.sh <study> --still`. Compare the motion budget with the
   mood's target (`moods.md`); calm 0.1–2%, dramatic ≤ ~5%.
10. **Present** the 3× still (`art/out/reels/<study>.png`), the preview GIF
    (`art/out/_preview/<anim>.gif`), rounds used, motion budget. Commit only after approval.

## Skeleton (plain night scene)

```js
// <study> — <one line>. Light: the moon <where> (key light); <other sources>.
// Focal point: <what, where>. Mood: <words>. Accent: <accent> (<which sources>).
include("../lib/night_sky.px.js")      // + night_lights / night_reflections / night_rain / ...
include("../lib/ridge.px.js")
include("../lib/dither.px.js")

var W = 360, H = 640, HORIZON = 300
nightPalette("warm")
var K = nightKeys()                     // night key → key in this palette: always draw with K("x")
var SKY = { horizon: HORIZON, moon: { x: 270, y: 150 }, stars: { maxY: 220 }, clouds: { amount: 1 } }
var MOON = nightLight(SKY)
// ... terrain functions drawing with K("...") ...
var ITEMS = function (animate) { return [...nightSky(SKY), /* terrain, kit items */] }
scene("<study>", { w: W, h: H, bg: K("U") }, ...ITEMS(false))
anim("<study>_loop", { w: W, h: H, frames: 24, fps: 12 }, ...ITEMS(true))
sprite("_<study>_loop_static", { w: W, h: H }, function (c) { /* what never moves, in any key */ })
```
