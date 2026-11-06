# Night notes: techniques worth borrowing

Research for the "night artist" (modules + a skill that make new night scenes in 1–2 rounds).
Read only: nothing was installed or copied. Each technique is translated to our rules from
`docs/art-direction.md`: **stepped glow, not additive light · palette-locked · hard edges ·
deterministic (seeded, frame = f(phase))**.

## Licences at a glance

| Source | Licence | What we may take |
|---|---|---|
| [jackcoldrick90/nightcity](https://github.com/jackcoldrick90/nightcity) | **None** (no LICENSE file, GitHub reports none) = all rights reserved | Ideas and numbers only. No code. |
| [Deep-Fold/PixelSpace](https://github.com/Deep-Fold/PixelSpace) | Code **MIT** (© 2021 Deep-Fold). README: generated images may not be distributed or sold *on their own* | Ideas, and code if credited (MIT notice). We don't use its generated images. |
| [Lospec](https://lospec.com/palette-list/tag/night) palettes, e.g. [Moonlight 15](https://lospec.com/palette-list/moonlight-15) by Tofu | No licence stated per palette; colour lists aren't generally copyrightable | Palette **structure** only (as asked). No hex values copied. Credit authors as a courtesy if we ever name one. |
| [godot-weather-fx-free](https://github.com/Spyridon-Pikoulas/godot-weather-fx-free) (heyheythere) | **CC BY 4.0** | Ideas freely. If code is ported: put `Weather FX Free by heyheythere - https://heyheythere.itch.io/weather-fx-free - CC BY 4.0` in the file header. |
| [godotshaders: Rain Drop (floor effect)](https://godotshaders.com/shader/rain-drop-floor-effect/) by Seed (Kode Game Studio) | **CC0** (site licence for shader code; the file header says "CC0 / MIT") | Anything. Credit anyway. Images on the page are not covered. |
| `.claude/skills/pixelfx` ([patch-gg/pixelfx](https://github.com/patch-gg/pixelfx)) | **MIT** (© 2026 Patch). Rain, fireflies and lightning are themselves adapted from Hugo Duprez's Sprite Fusion effects, **MIT** | Ideas, and code with both MIT notices. It paints with alpha and additive light, so we port the ideas, not the code. |

Nothing below needs ported code. Every item is a technique re-implemented in our own lib.

---

## 1. nightcity (glow, flicker timing, random phases, parallax)

**Glow as rings.** Every halo is code, not painted. It is drawn as **5 concentric rings with a
quadratic falloff**. Three rings left a hard circular edge that "read as a disc sitting on the
picture". Their rings are additive. Ours:
- A light = core key + a **chain** of accent keys stepping outward (`warm` chain `5 4 3 2 1`),
  then the last ring lands on the base colour underneath. One flat colour per ring, no alpha.
- Use **4–5 rings**, with radii spaced quadratically (r_i ∝ i², e.g. 1, 2, 4, 7, 11 px) so the
  outer rings are wider and thinner in value, not evenly spaced bands.
- Ring pixels on a surface don't replace it with the ring colour. They step it **one key up its
  own ramp** (pxl `glow(keys, { ramp })`) for the outer rings, and use accent keys only for the
  inner 1–2 rings. That's what makes it read as light falling on things rather than a disc.
- **Big lit panes get the dim colour.** A lit rectangle's brightness reads in proportion to its
  area: big windows use warm `3` or `2`, only small points get `5`. Keep the moon (or the one
  focal light) the brightest value in the image.

**Flicker timing (their numbers, in seconds):** neon buzz every 5–16 s; rooftop signs 9–26 s;
lamp stutter 8–40 s; star twinkle period 1.2–5 s; beacon 2.6–4.4 s. A buzz is a burst of
0.18–0.53 s that toggles lit/dropped every 0.04–0.11 s.
- Ours are 2 s (24 f) or 4 s (48 f) loops, so rare events must fit the loop: **at most one buzz
  per loop per sign**, triggered on a seeded frame, 2–6 frames long (0.17–0.5 s at 12 fps),
  toggling every frame. Most signs and lamps are **steady for the whole loop**.
- "Lit" vs "dropped" are two palette states (core `5` ↔ `3`, the rings one step down), never an
  alpha fade.

**Most lights never change.** About 2,300 windows on independent timers gave 40 changes per second,
which reads as static. A window's on/off state is decided once from the seed; only **~3%** have a
timer. Their measured target: **~0.4% of the screen in motion** with the camera still ("90% still
painting"). We can measure the same: count pixels that differ between frames of a loop. That makes
a good `reel.sh` check.

**Random phases.** "Anything synchronised reads as a machine." Every emitter gets its own phase
from `(seed, layer, index)`, never from which art variant it drew. Ours: phase = `hash2(id, seed)`,
and periods are **whole divisors of the loop** (1, 2, 3 or 4 cycles per loop) so the loop still
wraps.

**Parallax.** Layer offset = `Math.floor(-cam * f)`; "the floor is not optional": sub-pixel parallax
makes every layer shimmer. Their factors: sky 0, moon 0.03, stars 0.05, far 0.15, mid 0.35,
near 0.65, street 1.0, foreground 1.35. Ours is the same rule (`src/camera` whole-pixel pan);
keep the factor table as the default for any night pan.

**Also worth keeping:** measure contrast instead of judging it (four "invisible" effects were all
colours within ~2–21 luminance points of what was behind them). Our `night-sheet.mjs` now checks
palette spacing in OKLab, and it could also check a light against its background.

## 2. PixelSpace (stars, nebulae)

- **Quantise the noise, then look up the ramp.** Nebula/dust value = fbm × cloud-noise, then
  `floor(v * 7) / 7` indexes a colour ramp. That gives hard, banded steps with no blending. Ours:
  `rampKey(v, "UDduk")` with ≤ 5 steps.
- **A thin bright rim around every cloud:** two thresholds a little apart (`step(n, 0.1+d)` and
  `step(n, 0.115+d)`). Pixels between them get a brighter colour index. That gives a 1 px lit edge
  for free on nebulae, cloud tops and fog banks. Ours: two `fbm2` thresholds → `l` rim on `C` cloud.
- **Ordered dither = nudge the value before quantising** (×0.95 on checker pixels), so the dither
  only appears at band boundaries. Ours: Bayer 4×4 (`bayer4`) in the same place, only between
  adjacent keys of one ramp.
- **Falloff from the centre** (`d = distance(uv, centre)` added to the threshold) concentrates a
  nebula/Milky Way band instead of tiling it evenly.
- **Star count from area:** small stars ≈ area/150, scattered 25–100% of that; "big" stars are
  stamped sprites from a sheet of 5 variants, ≤ max(w, h)/20 of them. For 360×640: about 380–1,500
  dots before masking (we use far fewer, high only), and **≤ 12 big stars** (plus/cross shapes, 1–2
  of them with a `5`-key core in `silver`).

## 3. Lospec night palettes (structure only)

Looked at Moonlight 15, UnderNight 20, 3 am, BLUE GLASS, escape9, CyberGum6, Neon Night Sky:
- **One long luminance spine** from near-black violet to bright cyan/ice (Moonlight 15 is a 10-step
  spine plus a 5-step green branch that **shares the dark teal end**). → our `sky` + `moon` ramps
  form the spine; `teal` and `land` branch off it at the dark end.
- **Darks lean violet, lights lean teal/ice** (the night version of hue shifting: cool shadows,
  "warm" = cyan-ish lights). No neutral greys.
- **A tiny warm island** (UnderNight: 4–6 muted rose/peach colours at the end) is the only warm hue.
  It is never mixed into the blues. → our swappable accent.
- **Neon palettes are two hues** (pink + cyan, CyberGum6) over a dark teal/plum base. → our `neon`
  accent is 3 pink + 2 cyan, and borrows base teal for the cyan's outer rings.
- What to avoid, seen in our own old `night` palette: **29 colour pairs closer than ΔE 0.035**
  (e.g. cloud `C` and far `f` are the same colour). Night ramps converge in the darks, so wasted
  slots pile up there. The new palette is checked for that.

## 4. godot-weather-fx-free (rain, fog, pixel mode)

**Pixel mode** = snap every sample to the centre of its pixel block in **world** space
(`floor(p / px) + 0.5`), quantise colour to N steps, and quantise alpha to **8 flat bands** "so a
thin veil stays a veil instead of a dither pattern". Ours has no alpha, so: **a veil = one ramp step
up, applied on a Bayer threshold only where the veil is thick**; thin veils are a flat 1-step lift
over a whole band, no dither.

**Rain:**
- **3 depth layers**, nearer = longer, wider, faster, brighter: speed `520 + 780·depth` px/s,
  length `drop · (0.4 + 0.6·depth)`, opacity `0.35 + 0.65·depth`. Ours at 12 fps: far drops 2 px
  in sky `u`, mid 4 px in haze `c`, near 7–10 px in moon `n` with a 1 px `o` head.
- **Slant by skewing space** (`q.x -= q.y * slant`), so every drop falls straight down in the skewed
  space. That is the easy way to get jaggy-free slanted streaks: draw vertical runs and shift each
  run by whole pixels (a regular 3-1-3 stair, never irregular).
- **Columns + hashed cells** pick where drops exist (`density` drops a cell). It's deterministic, so
  it suits our loops: make the fall distance per loop a whole multiple of the cell height.
- **Splash = a flattened ring (ellipse ry = 0.45·rx) + two droplets on a parabola**, life
  fading as `(1 - age)^1.5`. Ours: 3-frame splash (ring of 3 px → 5 px → 2 dots), keys `n`→`l`.

**Fog:** 3 layers of **domain-warped fbm** drifting at different speeds, `smoothstep` threshold,
thicker toward the ground (`ground_fog` mixes in a vertical ramp). Ours: same density field, then
**threshold into 2–3 haze keys** (`L`, `C`, `c`) with a hard edge, plus the PixelSpace two-threshold
rim on top. Drift = whole-pixel offset per frame from `c.phase`.

## 5. godotshaders "Rain Drop (floor effect)" (ripples)

- A **grid of cells**; each cell hashes a drop position and a **start phase**
  (`t = fract(0.3·time + hash(cell))`), so ripples are evenly spread but never synchronised.
- Each ripple is an expanding ring `d = |p - drop| - R·t` whose strength fades as `(1 - t)²`; it
  checks the 5×5 neighbour cells so rings can cross cell borders.
- The shader **distorts** the floor (refraction). We don't: ours draws the ring instead.
  **Ripple = 1 px ellipse outline (rx : ry ≈ 3 : 1 for a floor seen at an angle), lit on the
  moon side (`n`/`z`), dark on the far side (one step down), shrinking to dashes as it fades.**
  Life of 4–6 frames, radius 1 → 6 px. Phase per cell from `hash2`, and a whole number of ripples
  per cell per loop so it wraps.
- On a puddle, the ring also breaks the reflection column: shift the reflection's dash rows by
  ±1 px where a ring crosses (pixelfx rain-splash does the same).

## 6. Our pixelfx skill (rain, lightning, sparks, fireflies)

pixelfx draws into a colour buffer (alpha, dithered) **and a light buffer (additive)**. We keep
the shapes and the timing, and drop the light buffer. Every glow becomes a stepped chain.

- **Rain (weather/rain):** **4 depths** with explicit counts (200 / 150 / 96 / 42 drops),
  lengths 2 / 4 / 7 / 13 px and three-tone streaks (tail, body, head = dark → bright). Far drops
  **end in the air** (they don't reach the floor), near ones splash. **Gusts** = a noise field swept
  sideways that thins drops in sheets. Puddles are thin strips that hold the sky (sky key one step
  darker). A low mist band sits over the wet floor.
- **Fireflies (weather/fireflies):** each has a Lissajous path (whole cycles per loop + looped
  noise) and **its own rhythm: quick rise (6%), hold (8%), slow fade (26%), dark the rest**;
  35% flash twice. Far ones are a single dot, near ones get a short trail of 4 past positions while
  lit. Ours with `warm`: core `5` at peak / `4` while fading, ring 1 = `3`, outer ring = grass key
  stepped up 1 (`glow ramp`). Rhythm counts snap to 1–4 per loop.
- **Lightning (lightning/_lib):** bolt = **midpoint displacement** to ~3 px segments (first swing
  32% of length, ×0.52 per level), with **forks** that thin (w × 0.55) up to 2 levels deep. It is
  inked by **level in a grid, higher wins** (halo < body < core), so a fork's halo never covers the
  trunk. That is palette-friendly already. **Stroke flicker = a fixed brightness table per frame**
  `[1, .72, .3, .95, .5, .8, .22]` and 3 return strokes at 0.76 / 1.04 / 1.26 s. Ours: the bolt in
  `silver 5` core / `silver 4` body / `silver 2` halo, and the **sky flash = the whole sky ramp
  shifted one step up for 1–2 frames** (the table becomes "which frames are +1 / +2"), never a
  white overlay.
- **Sparks (impacts/hit-spark, `Particles`):** vary every particle (size, speed, delay, life); fast
  in, slow out; white only for the hottest core and only for 1–2 frames. Ours: sparks are 1–2 px
  `warm 5` heads with a `warm 3` → `warm 2` tail of 1–3 px, under gravity, dying into `warm 1`.
- **General habits from its checklist:** "washed out" → darker edge steps and less glow; "a
  checkerboard where smoke should be" → for us, wider bands instead of dither; "seam when a loop
  wraps" → everything from `c.phase` with whole cycles.

---

## What this means for the night artist

Done (step 2, `art/lib/`, palette-locked, pure functions of `phase`; see `art/CLAUDE.md`):
`nightPalette` · `nightSky` · `lights` (5-ring glow, pools, windows, `nightFlicker`, `lightBeam`) ·
`cityLights` · `reflections` · `fireflies`; motion budget in `reel.sh`.
Done (step 3): `rain` · `ripples` (ring and light modes) · `fog` · `lightning` · `meteor`, each
with a test in `art/studies/night_tests/`.
Still to do: rain splashes · star counts from area + big-star stamps.

## The night palette system (step 1)

`art/lib/night_palette.px.js`: **night_base (27) + one accent (5) = 32.**
`include("../lib/night_palette.px.js"); nightPalette("warm" | "neon" | "silver")`.

| ramp | keys | role |
|---|---|---|
| sky | `U D d u k` | zenith → horizon, sky mirrored in calm water |
| moon | `N n o w` | moon disc, moonlit rims, moon path |
| haze | `L C c l` | clouds, mist, fog, far ranges |
| teal | `H F f h z` | water, far hills, foliage, wet surfaces |
| land | `B R r b t` | rock, dark earth, silhouettes (`B` = darkest) |
| ground | `A S s a` | sand, soil, paths (the base's warmest ramp) |
| accent | `1 2 3 4 5` | `warm` (lamps, windows, fireflies) · `neon` (1–3 pink, 4–5 cyan) · `silver` (moon halo, sheen, lightning) |

**Accents are for light sources only** and the light they throw. Objects and materials use base
colours even when they are colourful by day (beach_night's starfish: ground `S s a`, not warm).

Swatches, glow chains and the mapping of every existing night scene:
`node art/scripts/night-sheet.mjs` → `art/out/night/index.html`.
