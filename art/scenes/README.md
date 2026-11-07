# Night scenes as JSON

A night scene can be written as JSON instead of a study. `art/lib/night_scene.px.js` validates it,
fills every missing field from the **closest approved recipe**, maps the friendly words below to
the kit's numbers (the good ranges in `.claude/skills/night-artist/kit.md`), applies the night
rules (`rules.md`), and builds the scene with the night kit.

```sh
art/scripts/reel.sh --scene art/scenes/<file>.json [seconds]   # still + loop, every check
node art/scripts/scene.mjs art/scenes/<file>.json --compare <study>   # pixel-compare with a study
```

`reel.sh --scene` writes `art/out/reels/<name>.png` (3× still) and `<name>_loop.mp4` (default: the
shortest whole number of cycles ≥ 10 s), runs the palette check, the static check (the mask is
generated: moon disk + terrain, minus everything that moves over it) and reports the motion budget
against the scene's own target. It prints what the builder decided: the recipe used, defaults, and
every rule it applied. The wrapper study it builds is `art/out/_scenes/<name>.px.js` (generated).

| file | what | status |
|---|---|---|
| `lake_night.json` | `studies/lake_night.px.js` as JSON | identical: still + 72 loop frames |
| `valley_night.json` | `studies/valley_night.px.js` as JSON | identical: still + 72 loop frames |
| `mountains_night.json` | `studies/mountains.px.js` (night) as JSON | identical: still + 24 loop frames |
| `desert_night.json` | `studies/desert.px.js` (night) as JSON | identical: still + 24 loop frames |
| `sea_night.json` | `studies/sea.px.js` (night) as JSON | identical: still + 24 loop frames |
| `jungle_night.json` | `studies/jungle.px.js` (night) as JSON | identical: still + 24 loop frames |
| `harbour_night.json` | `studies/harbour_night.px.js` as JSON | identical: still + 24 loop frames |
| `beach_night.json` | `studies/beach_night.px.js` as JSON | identical: still + 48 loop frames + static mask |
| `harbour_rain.json` | harbour_night + light rain, fog low over the bay, neon accent, no moon (JSON only) | pending approval |

Static masks: lake_night and valley_night's generated masks guard more pixels than the studies'
hand-written ones (the render is identical; only what the static check guards differs). The
mountains, desert, sea, jungle and harbour studies have no mask, so their JSON scenes have none.
| `valley_rain.json` | valley_night + light rain + lit windows of a small far village instead of fireflies (JSON only) | pending approval |

## Format

```json
{
  "name": "valley_rain",
  "about": "one line for people (ignored by the builder)",
  "accent": "warm | neon | silver",
  "length": "short | medium | long",
  "mood": "lonely, peaceful",
  "sky": {
    "horizon": "high | mid | low",
    "moon": { "shape": "full | crescent", "x": "left | center | right | notch", "y": "high | mid | low", "hidden": false },
    "stars": "low | medium | high | false",
    "clouds": "none | low | medium | high",
    "meteor": true
  },
  "terrain": [ { "type": "ridges | sea | lake | river | dunes | jungle | valley", "...": "options" } ],
  "lights":  [ { "type": "lamp | windows | city | fireflies", "...": "options" } ],
  "weather": { "rain": "light", "fog": "thin", "lightning": false },
  "motion":  { "budget": "calm | magical | dramatic" }
}
```

Only `name` and `terrain` are required. Anything left out comes from the closest recipe (printed
as `closest recipe: …`); objects merge field by field, lists (`terrain`, `lights`) replace. Every
friendly word also accepts a number inside the kit's good range; anything else is an error that
lists what is allowed. Unknown fields are errors.

### Top level
| field | words → numbers | number range |
|---|---|---|
| `name` | lower case, `a-z 0-9 _`; assets `<name>`, `<name>_loop` | |
| `accent` | `warm` (lamps, fireflies) · `neon` (signs) · `silver` (moon only) | |
| `length` | loop cycle: `short` 2 s (24 f) · `medium` 4 s (48 f) · `long` 6 s (72 f) | 1–6 s |
| `mood` | a word, a list, or `"a, b"`: `lonely cozy eerie stormy magical peaceful calm` | |

### `sky`
| field | words → numbers | number range |
|---|---|---|
| `horizon` | `high` 280 · `mid` 300 · `low` 330 (y) | 280–470 |
| `moon.shape` | `full` (halo r 14) · `crescent` (cut 7, −5; ring halo 2.5, 5.5) | |
| `moon.x` | `left` 88 · `center` 180 · `right` 272 · `notch` (the ridges' notch) | 40–320 |
| `moon.y` | `high` 140 · `mid` 180 · `low` 220 | 100–260 |
| `moon.hidden` | `false` · `"half"` (lower half behind a cloud) · `"glow"` (no disk: a dim dithered glow behind overcast) · `true` (no moon; its position still sets the light direction) | |
| `stars` | `false` · `low` 0.5 · `medium` 1 · `high` 1.5 (density; maxY = horizon − 90) | 0.2–3.4 |
| `clouds` | `none` · `low` (cumulus 0.6) · `medium` (cumulus + stratus 0.8) · `high` (1.2) | |
| `meteor` | `true` (2:1 path away from the moon, once per loop) · `false` · `{ from, to, at, dur }`; any terrain; sky order: stars → meteor → moon disk/halo → clouds (→ a hidden moon's glow), so meteors pass behind clouds | |

### `terrain` (back to front, in list order)
| type | options | built |
|---|---|---|
| `ridges` | `ranges` 1–2 (2 = far `D` + near `r`) · `height` `low` 80 · `medium` 100 · `high` 120 (40–160) · `peaks` `soft` 0.4 · `sharp` 0.7 · `notch` `left/center/right` or x (a V cut for the moon/river source) · `seed` | yes |
| `lake` | `lines` `few` 5 · `some` 9 · `many` 14 (calm `F` lines); the shore is the horizon | yes |
| `valley` | `floor` (default horizon + 52) · `seed`: mid ranges, teal meadow, near slopes closing in on the river | yes |
| `river` | `width` `narrow` 80 · `medium` 120 · `wide` 160 · `wind` `low` 45 · `medium` 90 · `high` 135 · `flow` `slow` 0.2 · `medium` 0.4 · `fast` 0.8 px/frame · `grass` true/false; from the notch toward the viewer, moon glitter clipped to it | yes |
| `ridges` `style: "alpine"` | **land**: the mountains study (4 ranges, hero peak, snow) | yes |
| `dunes` | **land**: the desert study (far mesas, hero mesa, dunes) | yes |
| `sea` | **land**, `style` (required): `calm` (the sea study: open sea, moon column, rocks, beach) · `surf` (beach_night: breakers, dune, starfish, 4 s) · `harbour` (harbour_night: bay, hills, window view) | yes |
| `jungle` | **land**: the jungle study (canopy gap, shafts, vines) | yes |

### `lights`
| type | options | built |
|---|---|---|
| `lamp` | `on: "jetty"` (needs a lake): `x` `left` 96 · `center` 180 · `right` 264, `deck` y, `height` `short` 40 · `tall` 70 (24–90) · `on: "bank"` (needs a river): `side` `left/right`, `at` `far/mid/near`, `height`; the bank spot is computed from the river (the row with the most water below the post) | yes |
| `fireflies` | `count` `few` 6 · `some` 8 · `many` 12 (6–14) · `place` `bank` (river) · `grass` (valley meadow, river grass, beach dune grass, the jungle clearing) · `shore` (lake far shore, sea beach, beach dune lip) · `auto` (bank → grass → shore), areas from that terrain's geometry; not on desert, mountains or the harbour (no near shore/grass); old `along` `river`/`meadow` = bank/grass; optional `near`/`far` `[x, y, w, h]` (plain terrain) | yes |
| `windows` | a small far village: `at` `river` (both banks at the river's source) · `left` · `right` · `houses` `few` 5 · `some` 8 · `many` 12 (3–14) · `lit` `low` 0.4 · `medium` 0.6 · `high` 0.8 (share of window slots); dark houses in a cluster (two staggered rows), 1 px core windows, ~3% flicker, bright ones reflect in the water | yes |
| `city` | the harbour's far city (on/off; follows the accent: warm amber, neon pink/cyan); only with `sea` `harbour` | yes |

### `weather`
| field | words → numbers |
|---|---|
| `rain` | `false` · `light` 0.3 · `medium` 0.5 · `heavy` 1, or `{ amount, angle: none 0 · light 1/6 · strong 1/4, wind: none · gusts 0.3 · strong 0.5 }`; ground 560; ripples on the lake/river and over lamp reflections come with it |
| `fog` | `false` · `thin` (30 px) · `medium` (36) · `thick` (60), or `{ amount, colour, over, depth, drift, subject }`: `colour` `dark` L · `dim` C (quiet) · `light` · `sky` · `teal` · `moon` (need `subject: true`); `depth` `far` (just in front of the farthest land / low over the far water) · `mid` (on the water or a third down the land) · `front` (low veils in front of the near land, no solid band, wavy top *and* bottom edges; lights drawn after it shine through), any terrain; or `over` a terrain type (plain terrain only, not with `depth`); `drift` `left/right` |
| `lightning` | `false` · `true` = `"far"` · `"near"` · `{ distance, at }`: one strike per loop between the sky and the land (ground never flashes). `far`: a short bolt on the horizon away from the moon, the sky one step lighter around it; `near`: a tall bolt, the whole sky one step. Needs accent `silver` and ≥ 4 s (a land terrain with a 2 s loop is lengthened to 4 s; its own motion repeats). Flash frames are reported apart in the motion budget |

### `motion`
`budget`: `calm` 0.1–2% · `magical` 0.2–1.5% · `dramatic` 2–5% of pixels changing per frame.
Reported by `reel.sh` against the measured budget (never fails). `magical` also doubles star twinkle.

## Land terrains (the ported studies)

A **land** terrain is an approved study's whole land below the sky: `lib/land_<study>.px.js` holds
the study's drawing (moved verbatim; the study calls the same function), so a JSON copy is pixel-
identical by construction. A land terrain is the only entry in `terrain`. On top of it the JSON can
set: `accent`, `length` (a whole multiple of the study's loop), `sky.meteor`, `weather.lightning`,
`fireflies` (`place`), `fog.depth`, `sky.moon.hidden` (`"glow"`, `true`; hiding also drops the moon's reflections and
patches), `sky.stars` (density or false), `weather.rain` (+ ripples on open water; over the city's
reflections in light mode), `weather.fog` (low over the water, under the reflections, drifting 1.25
px/frame; over the harbour's lit bay veils only), the neon accent (harbour: cyan waterfront and
quay, pink towers and upper city), lights on/off (`city` for the harbour, `fireflies` for the jungle), `mood`, `motion.budget`.
Anything else is an error that says it isn't expressible yet.

### Not expressible yet (fixed by the studies)
- **All lands:** horizon; moon `x`, `y`, `shape`, `"half"`; clouds (amount, place) — so the "more
  cloud in rain" rule can't apply; static masks (only beach has one); combining a land with other
  terrain or with lamps/windows; the moonlit rims stay when the moon is hidden (they set the light
  direction); fireflies only where the study has a near shore or grass.
- **mountains:** the four ranges and the hero peak (profiles, faces, ledges, cracks, boulders,
  slabs), snow, haze drift, twinkle n 7.
- **desert:** far mesas, the hero mesa (strata, caprock, flare, cast shadow), dune layers, pebbles.
- **sea (calm):** horizon 286, shore 452 and the wet line, wave rows and bob, foam, the rock outcrop,
  the moon column's width.
- **jungle:** canopy gap, crown layers, clearing, moon shafts (`lightBeam` lift), vines, roots, its
  own fog bands; firefly count and areas (on/off only).
- **harbour:** window opening and sill, moonlight patch, cloud bank, hills, every `cityLights`
  option (downtown, streets, houses, roads, towers, shops, quay, flicker), boats, star density 3.4.
- **beach (surf):** breaker spots, peel and wind, wash, streaming clouds, grass, blown sand, the
  starfish, the moon path, the 4 s cycle.

## Rules the builder applies
Values the JSON sets explicitly are errors; values inherited from the recipe are fixed and logged.
- Rain → no stars, no meteor, clouds at least `medium`, and the moon `hidden: "glow"` (rules.md: a
  rainy sky; the moon is never a crisp shape in rain). An explicit `moon.hidden` overrides the glow
  (logged): `lake_night.json` keeps `"half"`, as approved.
- A lamp with a **full** moon → the moon half hidden behind cloud (lake lesson). A crescent stays
  clear: a cloud over it is lit by it and becomes the biggest bright shape (a lamp draft of valley_rain).
- Fog colour must be quiet (`dark`/`dim`) unless `subject: true` (valley + lake lessons).
- One accent; fireflies need `warm`; `silver` only when the moon is the only light; lightning needs
  `silver` and ≥ 4 s; ≤ 3 lamps; meteor 2:1 or 1:1 and away from the moon.
- Moon, lamps and meteor stay out of the safe zones (top 84, bottom 117, sides 20).
- Light direction: a moon in the outer thirds lights from its side; a central moon lights toward it.
- Objects (lamp posts, jetties, villages) are logged: each scene with one needs an exception in `art/CLAUDE.md`.
