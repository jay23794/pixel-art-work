# Night kit reference

All modules live in `art/lib/`, are palette-locked (night_base + one accent), hard-edged and
loop-safe. Modules that draw return scene items (spread or place them in `scene`/`anim`); call
them **after** `nightPalette()`. Includes are relative to the including file
(`include("../lib/night_rain.px.js")` from `art/studies/`). Each night_* file includes what it needs.

Keys: night_base `sky UDduk · moon Nnow · haze LCcl · teal HFfhz · land BRrbt · ground ASsa`,
accent `1–5` (dark → bright; neon: 1–3 pink, 4–5 cyan). `var K = nightKeys()`; draw with `K("R")`.

## Palette — `night_palette.px.js`
| call | use |
|---|---|
| `nightPalette(accent)` | `"warm"` (chain 5 4 3 2 1) · `"neon"` (3 2 1 / 5 4 + teal z h) · `"silver"` (5 4 3 2) |
| `nightPalette(accent, legacy)` | only for ports of old studies; end old-key drawing with `nightRemap()` |
| `nightKeys()` | `K("x")` → key; `K.state.chain` = the accent's glow chain |
| `nightRoles()` | old night letters (`l m` stars, `LCclm` clouds) → keys (for old helpers like breakers) |

## Sky — `night_sky.px.js`
`nightSky(opts)` → items; `nightLight(opts)` → `{ x, y, r }` (light from it).
| option | good | bad |
|---|---|---|
| `horizon` | the horizon/focal third: 280–470 | < 200 (sky band too thin for stars) |
| `moon: { x, y }` | on the lit side, inside the safe area, 30+ px from edges; y 110–220 | in the top 84 px; behind the focal point |
| `moon.crescent: { dx, dy }` | (6–8, −4…−6) thin, elegant crescent; use `glow: { rings }` | dx > r (moon vanishes) |
| `glow` | `{ r: 14, ramp: 1 }` default; `{ r: 18, ramp: 2 }` bright full moon; `{ rings: [2.5, 5.5] }` crescent; `false` hidden moon | ramp > 2 (washes the sky) |
| `stars` | `{ maxY: horizon − 60…120 }`, `density` 0.4–1 (lonely/rain lower), up to 3.4 for a clear showcase | `density > 4` (noise); `false` only for overcast/rain |
| `clouds` | `{ amount: 0/1/2, scale 0.5–1.4, x, y, top: 96 }` | clouds over the moon *and* the focal point; `top < 84` |
| `motion` | `{ twinkle: { n: 6–9, maxY } }`, `{ clouds: 1 }` px sway | twinkle n > 15 (busy) |
| `layer` | `"back"` stamp once + `"stars"` per frame for heavy loops | |
`nightOrPalette(time, accent, legacy)` → `{ sky, end }` for dusk + night studies.

## Lights — `night_lights.px.js`
`lights({ points, pools, windows, flicker, animate })` → items.
| option | good | bad |
|---|---|---|
| `points: [{ x, y, radii, paint, chain }]` | default radii [1, 2, 4, 7, 11], `paint: 3`; a distant lamp `radii [0,1,2,4,6]` | > 3 big points in one scene (no focal point); radii evenly spaced (reads as a disc) |
| `pools: [{ x, y, rx, ry, tint }]` | under a lamp on the ground, `rx : ry` ≈ 4–5 : 1; `tint: false` on water | pools on vertical surfaces; ry > rx |
| `windows: [{ x, y, w, h }]` | 1–6 px panes; big panes dim automatically | many big panes (light sheet) |
| `flicker: { rate, frames, seed }` | rate 0.03 (default); frames = the loop's frames | rate > 0.1 in a real scene (reads as faulty wiring) |
| `animate` | true in anims, false in stills | |
Helpers: `lightRings(c, K, o, lvl, chain)`, `lightPool`, `litWindow`, `nightDisc(c, x, y, r, key)`,
`nightLightKey(K, v, chain)` (brightness 0..1 → chain key), `nightFlicker(id, p, o)` (0 lit,
1 dropped), `lightBeam(level(x, y, c), { lift })` (moonlight shafts; lift `[0, 0, 1]` subtle,
`[0, 1, 2]` strong), `nightCool(K)` (cool-step lookup), `nightRepeat(item, n)` (item runs n× per loop).

## Reflections — `night_reflections.px.js`
`reflections({ source, top, minV, near, moon, boats, seed })` → `fn(c, phase|null)`.
| option | good | bad |
|---|---|---|
| `source` | `cityLights` result or `[{ x, y, v }]` (v 0..1 brightness) | lights far above the waterline (only `y ≥ top − near` reflect) |
| `top` | the waterline y | |
| `minV` | 0.6 (only bright lights reflect) | < 0.3 (every dot gets a streak: noise) |
| `moon: { x, y1, keys }` | glitter under the moon; keys `["N", "N"]` quiet, `["n", "N"]` brighter | glitter and a city column on the same x |
| `boats: [[x, y, v]]` | 0–4 light dots | |
Length ≈ 10 + 60·(v − 0.6) px; dashes 1–3 px with gaps, dimming one chain step at a time.
Moon glitter runs straight down from `moon.x`; on a winding river wrap it in pxl's
`clip(inRiver, function (c) { refl(c, phase) })` so it only shows where the river passes under the moon.

## City — `night_city.px.js`
`cityLights({ shore, ridge, w, downtown, streets, houses, roads, towers, shops, quay, keys, flicker })` → `fn(c, phase|null)`, `fn.lights`.
Good: `downtown.w` 40–70 (a clear peak), towers 5–8 narrow (6–12 px), streets 4–8 rows.
Bad: no downtown peak (uniform carpet), towers > 14 px wide (read as objects), `houses` > 120.

## Fireflies — `night_fireflies.px.js`
`fireflies({ count, near, far, path, keys, halo, seed })` → item (loops only).
Good: count 6–14, `keys { core: "4", ring: "3" }` with warm, near area over the focal clearing;
areas computed from the terrain they belong to (a bank: `[bankX − w, y, w, h]`).
Bad: > 20 (reads as sparks), with silver/neon accent (wrong colour).

## Rain — `night_rain.px.js`
`rain({ area, angle, density, wind, ground, layers, seed })` → item.
| option | good | bad |
|---|---|---|
| `angle` | 0 (still air), ±1/6–±1/3; snaps to 1/n | > 1/2 (looks like hail sideways) |
| `density` | 0.4–0.6 drizzle, 1 heavy | > 1 (no effect: share of slots) |
| `wind` | 0–0.5 gusts | 1 (rain vanishes in sheets) |
| `ground` | where near drops land (the near ground/water y) | above the horizon |
4 depths (far → near): len 2/4/7/13 px, keys `ccc · Ccl · cll · lnn`, ~10–30 px/frame. A rainy sky:
`stars: false`, more clouds. Motion ≈ 1% at density 1.

## Ripples — `night_ripples.px.js`
`ripples({ area, cell, per, life, rmax, ratio, keys, mask, mode, seed })` → item.
| option | good | bad |
|---|---|---|
| `mode` | `"ring"` on puddles/wet ground; `"light"` over reflections (breaks the dashes) | ring mode over a lit reflection (rings on top of light) |
| `rmax` | 8–11 | < 6 (invisible at 1×) |
| `ratio` | 3 (floor at an angle); 4–5 for far water | 1 (circles: looks top-down) |
| `cell` | [18–28, 8–12]; `per` 1–2, `life` 0.4–0.5 | tiny cells (carpet of rings) |
| `keys` | `"nlC"` fresh → old on dark water | keys darker than the water |
| `mask(x, y)` | puddle shapes | |

## Fog — `night_fog.px.js`
`fog({ top, height, bands, role, density, amp, sway, motion, dir, drift, period, seed })` → item.
| option | good | bad |
|---|---|---|
| `top`, `height` | low over water: top = shore + 2…6, height 25–40; valley: 40–120 | across the shoreline (reads as a stripe); covering the focal point; > 200 |
| `bands` | 3 (veil, veil, solid) | > 5 (stripes) |
| `role` | `"haze"` (default), `"L"` (quiet mist: darkest haze), `"sky"`, `"teal"`, `"moon"` (bright mist) | `"ground"` over water; a light solid band behind a dim focal point |
| `amp` | 5–10 px | 0 (ruled lines) |
| `motion` | `"sway"` (any loop; `sway` 4–8 px); `"drift"` with a 72-frame loop, `period: 180, drift: 90` (1.25 px/frame) | `drift: 180` (2.5 px/frame slides); drift in a 24-frame loop; `period: 90` (small repeating bumps read as waves) |
Fog bands are veils that turn what's behind cool and one/two steps lighter; only the last band is solid.

## Lightning — `night_lightning.px.js`
`lightning({ frames, at, pattern, horizon | sky, bolt, keys, seed })` → item.
Good: frames 48–72 (≤ 1 strike / 4 s), `bolt: { from: cloud base, to: ground }`, keys `{ core: "w", body: "5", halo: "3" }` with silver.
Bad: frames 24 (a strike every 2 s), custom pattern with > 3 flash frames, lifting the ground.

## Meteor — `night_meteor.px.js`
`meteor({ from, to, frames, at, dur, tail, keys, seed })` → item.
Good: 2:1 or 1:1 path, 150–220 px long, dur 6–9 frames in a 48-frame loop, away from the moon.
Bad: irregular slope (jaggy stairs), crossing the focal point, more than one per loop.

## Night scene from JSON — `night_scene.px.js`
`nightScene(spec, verbose)` → defines `<name>`, `<name>_loop`, `_<name>_loop_static`; returns the
resolved config. Format, words → numbers, rules: `art/scenes/README.md`. Built terrain: ridges, lake,
valley, river + the land terrains; lights: lamp (jetty/bank), windows (a far village), fireflies, city (harbour). Recipes in `NS_RECIPES`, per-type defaults in
`NS_TYPE_DEFAULTS`. Normally run through `reel.sh --scene` (the wrapper is generated).
Land terrains (`ridges` alpine, `dunes`, `sea` calm/surf/harbour, `jungle`) run the studies' own
code from `lib/land_<study>.px.js` (`define(time, o)`, hooks in `lib/land.px.js`); what the JSON
can't change on them is listed in the README.

## Terrain (your own drawing, with night keys)
| module | calls | notes |
|---|---|---|
| `noise.px.js` | `hash2(seed, x, y)`, `vnoise1/2`, `fbm1(seed, x, { octaves, gain })`, `fbm2` | 0..1, seeded |
| `ridge.px.js` | `ridgeProfile(w, { y, amp, scale, seed, octaves, gain, sharp, shape })` → top y per x; `slopeAt(p, x, r)`; `cleanProfile`; `ridgePoly` | `sharp` 0.6–1 for peaks; `scale` 40–90; rim-light where `slopeAt` faces the moon |
| `dither.px.js` | `rampKey(x, y, v, keys, soft)`, `ditherKey`, `bayer4` | large gradients only, adjacent keys |
| `breakers.px.js` | `breakers({ spots, peel, wind, light, column, animate, keys })`, `breakerWash` | in a plain night scene pass `keys` through `nightRoles()`: `var R = nightRoles(), BK = {}; for (var k in BREAKER_KEYS) BK[k] = R(BREAKER_KEYS[k])` |
| `sky.px.js` | used by `nightSky`; don't call `skyLayer` in night scenes | |
Typical terrain keys: far range `D`/`d` (rim `u`); mid range `r` (rim `b`); near land `R`/`B`
(rim `r`); water `H`/`F` (lines `f`); sand/soil/wood `S`/`s` (lit `a`).
