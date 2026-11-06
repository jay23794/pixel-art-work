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
| `meteor` | `true` (2:1 path away from the moon, once per loop) · `false` · `{ from, to, at, dur }` | |

### `terrain` (back to front, in list order)
| type | options | built |
|---|---|---|
| `ridges` | `ranges` 1–2 (2 = far `D` + near `r`) · `height` `low` 80 · `medium` 100 · `high` 120 (40–160) · `peaks` `soft` 0.4 · `sharp` 0.7 · `notch` `left/center/right` or x (a V cut for the moon/river source) · `seed` | yes |
| `lake` | `lines` `few` 5 · `some` 9 · `many` 14 (calm `F` lines); the shore is the horizon | yes |
| `valley` | `floor` (default horizon + 52) · `seed`: mid ranges, teal meadow, near slopes closing in on the river | yes |
| `river` | `width` `narrow` 80 · `medium` 120 · `wide` 160 · `wind` `low` 45 · `medium` 90 · `high` 135 · `flow` `slow` 0.2 · `medium` 0.4 · `fast` 0.8 px/frame · `grass` true/false; from the notch toward the viewer, moon glitter clipped to it | yes |
| `sea`, `dunes`, `jungle` | — | not yet: an error names the study to start from |

### `lights`
| type | options | built |
|---|---|---|
| `lamp` | `on: "jetty"` (needs a lake): `x` `left` 96 · `center` 180 · `right` 264, `deck` y, `height` `short` 40 · `tall` 70 (24–90) · `on: "bank"` (needs a river): `side` `left/right`, `at` `far/mid/near`, `height`; the bank spot is computed from the river (the row with the most water below the post) | yes |
| `fireflies` | `count` `few` 6 · `some` 8 · `many` 12 (6–14) · `along` `river` (areas from the banks) / `meadow`; optional `near`/`far` `[x, y, w, h]` | yes |
| `windows` | a small far village: `at` `river` (both banks at the river's source) · `left` · `right` · `houses` `few` 5 · `some` 8 · `many` 12 (3–14) · `lit` `low` 0.4 · `medium` 0.6 · `high` 0.8 (share of window slots); dark houses in a cluster (two staggered rows), 1 px core windows, ~3% flicker, bright ones reflect in the water | yes |
| `city` | — | not yet (see harbour_night) |

### `weather`
| field | words → numbers |
|---|---|
| `rain` | `false` · `light` 0.3 · `medium` 0.5 · `heavy` 1, or `{ amount, angle: none 0 · light 1/6 · strong 1/4, wind: none · gusts 0.3 · strong 0.5 }`; ground 560; ripples on the lake/river and over lamp reflections come with it |
| `fog` | `false` · `thin` (30 px) · `medium` (36) · `thick` (60), or `{ amount, colour, over, drift, subject }`: `colour` `dark` L · `dim` C (quiet) · `light` · `sky` · `teal` · `moon` (need `subject: true`); `over` a terrain type (sits just in front of it); `drift` `left/right` (drift at 6 s, sway otherwise) |
| `lightning` | `false` · `true` · `{ at }`: needs length ≥ 4 s and accent `silver` |

### `motion`
`budget`: `calm` 0.1–2% · `magical` 0.2–1.5% · `dramatic` 2–5% of pixels changing per frame.
Reported by `reel.sh` against the measured budget (never fails). `magical` also doubles star twinkle.

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
