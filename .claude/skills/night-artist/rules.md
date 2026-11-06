# Night rules and lessons

Hard rules first, then lessons learned the hard way (each one cost a round).

## Light
- **The moon is the key light.** One light direction per image, from the moon's side. Rims and
  lit edges face it; faces away are shadow. A dusk study's night keeps the dusk sun's side
  (put the moon there).
- **One accent per scene** (`warm`, `neon` or `silver`). night_base (27) + accent (5) = 32.
- **Accents only on light sources** and the light they throw: lamps, windows, signs, fireflies,
  the moon's halo, lightning, reflections of those. Objects and materials use base colours even
  when they are colourful by day (beach_night's starfish: ground `S s a`, not coral).
- **Stepped glow, never additive.** A light = core accent key → accent chain rings → the surface
  stepped up its own ramp (`lights` 5 rings at radii 1, 2, 4, 7, 11). No alpha, no blur, no
  colour-mode `glow()`, no `lighting()`.
- **Big lit areas get dim keys.** Brightness reads by area: a large window in the core colour
  outshines the moon. Small points get the core; big panes chain[2–3] (`litWindow` does this).
- **Focal point = the brightest value contrast**, and only one. If a lamp is the focal point, keep
  other lights dimmer and smaller.
- Moonlight through gaps (shafts, windows) turns what it crosses **cool** (`lightBeam`), not
  brighter in its own hue (jungle lesson: teal shafts looked like green glass).

## Motion
- **~3% of lights ever change** (`nightFlicker` default). Most lights are steady for the whole loop.
- **At most one burst per loop per light** (2–6 frames, toggling dropped/lit).
- **Nothing synchronised:** every emitter has its own seeded phase; periods are whole divisors of
  the loop (1–4 cycles per loop) so it still wraps.
- **Motion budget** (`reel.sh` reports % of pixels changing per frame): calm 0.1–2%, dramatic
  (breaking waves, storms) ≤ ~5%. ~0% is fine for intentionally subtle scenes (mountains,
  desert: star twinkle only). The budget is reported, never enforced — judge it against the mood.
- **Lightning safety:** at most one strike per 4 s; the flash is the sky up **one** step for
  **≤ 3 frames**; never a full-screen bright flash; ground and foreground never flash.
- Loops: 24 frames at 12 fps (2 s) default; 48 for rare events (lightning, meteor, waves);
  **72 max** (pxl's 16.7 Mpx image cap at 360×640). Fog `drift` = one long cycle (72 f) with
  `period: 180, drift: 90` (1.25 px/frame; 2.5 px/frame reads as sliding, not drifting); fast
  modules inside it via `nightRepeat(item, n)`.
- Everything moving reads `c.phase`; no `Math.random`, no time. Seamless = whole cycles per loop.
- Mark what never moves in `_<anim>_static` (moon disk, terrain, objects); `reel.sh` fails if it
  changes. Leave out anything rain, fog or ripples pass over.

## Palette and pixels
- Draw only with keys from `nightKeys()` (`K("R")`), never `"#hex"` and never literal letters in
  lib code. Kit modules capture keys when called, so call them after `nightPalette()`.
- Hard edges; Bayer 4×4 dithering only between adjacent keys of one ramp on large gradients
  (sky, haze); never on small shapes or edges; no band narrower than 4 px.
- Clusters ≥ 2×2 (stars, sparkles, rain drops and specks excepted). Lines in regular runs: rain
  angle snaps to 1/n; meteor/line paths 2:1 or 1:1.
- Far = lighter/bluer/flatter (sky or haze keys, no outline, 2–3 steps); near = full contrast.
  At night far ranges sit in **sky/haze**, not teal (mapping lesson).
- Teal (`HFfhz`) is for water, wet surfaces and foliage; violet land (`BRrbt`) for rock and
  silhouettes; mauve ground (`ASsa`) for sand, soil, paths, wood in shadow.

## Lessons from the ports and tests
- **Measure colour, don't judge it.** Four "invisible" effects in nightcity were colours within a
  few luminance points of their background. Zoom-crop the area and compare keys; a fog/rain key
  must step at least one ramp step away from what's behind it.
- Old night palette had 29 near-duplicate pairs; the new one has none (ΔE ≥ 0.035). Don't add
  "almost the same" colours — use the ramp step.
- **Fog lightens.** A veil that maps to the nearest cool tone without a lift darkens dark rock
  (test round 2). Fog veils are +1, +2 steps; only the bottom band is solid.
- **Rain must be visible over the sky:** far drops in `c`, not `C` (round 1 was invisible). A
  rainy sky has no stars (`stars: false`) and more cloud.
- Ripple rings need `rmax` ≥ 8 to read at 1×; in light mode, aim the area at the reflection band.
- Test composition can lie: a flat bright far range behind fog hid the fog. Keep the background
  behind an effect darker than the effect.
- `c.light` steps along ramps by colour; in a scene with two ramps sharing a colour, the first
  ramp wins. The night palette has no shared colours.
- Top-level `function` names share one context across every included file: never name a study
  function like a kit function (`fireflies`, `lights`, `reflections`, `rain`, `fog`, ...).
- pxl images are capped at 16.7 Mpx: 72 frames of 360×640 per anim.
- Stamp heavy still layers (`_part` scenes) and draw only moving parts per frame.
- `breakers()` defaults to old night letters: pass `keys` translated with `nightRoles()` in a
  plain night scene (kit.md).
- Present the still before animating; commit only after approval.

## Lessons from lake_night (the first scene made with this skill: 4 rounds for the still)
- **Mist is quiet.** "Low over the water" = just *below* the shoreline (top = shore + 2…6), thin
  (height 25–40), solid band in the darkest haze (`role: "L"`). A light solid band (`c`, `C`)
  becomes the brightest shape and steals the focal point (round 1).
- **No water mirror when mist hides the shore:** a mirrored range cut off by mist reads as a
  dark forest on the far bank (round 2). Still dark water = flat `H` + a few long `F` lines.
- **When a lamp is the focal point, half-hide the moon** behind cloud (cloud over its lower half);
  a clear full moon is the bigger bright shape (round 2).
- **Draw an object's frame after its light:** `lights()` paints over whatever is under the rings,
  so lamp heads, window frames and posts go after the light item (round 3).
- Keep a light pool inside its surface: `ry` 1 on a 2 px deck, `rx` ≤ the deck's reach.
- Rain + ripples + drifting mist land around 1% at rain density 0.4: for lonely/peaceful use
  density 0.3 and ring cells ~[36, 14] (0.8%).
