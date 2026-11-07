---
name: night-director
description: Turn ONE sentence describing a night scene ("foggy desert at night with a meteor") into a valid PixelForge night scene JSON (art/scenes/<name>.json), render it with reel.sh --scene, critique it with night-artist and fix it in JSON (max 2 rounds), then report what changed from the sentence and why. Use when the user gives a one-line night scene brief or prompt, or asks for a night scene "from a sentence/prompt". JSON only — never writes drawing code.
---

# Night director: one sentence → scene JSON

You turn one sentence into a night scene **written only as JSON** (`art/scenes/<name>.json`, format
`art/scenes/README.md`). You never edit code (`art/lib`, `art/studies`, scripts). If the sentence
asks for something the format can't do, say so and use the nearest supported option.

Read first: `art/scenes/README.md` (the only allowed fields and values, incl. "Not expressible
yet"), `.claude/skills/night-artist/rules.md`, `recipes.md` (the "Choosing" table), `moods.md`.

## 1. Read the sentence
Pull out, word by word (write the list down — it becomes the report):
- **subject → terrain** (table below) · **weather** (rain, fog, storm, lightning) · **sky** (moon,
  stars, meteor, clouds) · **lights** (lamp, village/cabins/windows, city, fireflies) · **mood**
  words (`moods.md`) · **motion** hints (calm, quiet, stormy, magical).
- Anything with no mapping: note it as **unsupported** with the nearest option.

| sentence says | JSON | recipe |
|---|---|---|
| mountains, peaks | `ridges` (+ `style: "alpine"` for the approved mountains land) | mountains_night / valley_night |
| desert, dunes, mesa | `dunes` (land) | desert_night |
| sea, ocean, open water, calm sea | `sea` `style: "calm"` (land) | sea_night |
| stormy sea, surf, waves, beach | `sea` `style: "surf"` (land, 4 s, dramatic) | beach_night |
| harbour, bay, city across water, window view | `sea` `style: "harbour"` + `city` | harbour_night |
| jungle, forest canopy | `jungle` (land) | jungle_night |
| lake, still water | `ridges` + `lake` | lake_night |
| valley, river, stream | `ridges` (notch) + `valley` + `river` | valley_night |
| lamp, lantern, jetty | `lamp` (`jetty` on a lake, `bank` on a river) — standard element | |
| village, cabins, houses, windows | `windows` (a far village: `at`, `houses`, `lit`) — standard element | |
| fireflies | `fireflies` `place: auto` (or `bank`/`grass`/`shore`); not on desert, mountains, harbour | |
| no moon / moon hidden | `sky.moon.hidden: true` (`"glow"` = behind cloud) | |
| foggy, misty | `weather.fog` (`thin/medium/thick`, `dark`/`dim`); "foggy <place>" = `depth: "front"` (veils over the near land), "mist on the water/valley" = `mid`, "haze on the horizon" = `far` | |
| rain, drizzle / storm | `weather.rain` `light` / `medium` (+ `angle`); storms: light-to-medium, few gusts first (≤ 5%) | |
| lightning (far away / overhead), meteor | `weather.lightning` `"far"` / `"near"` (silver, ≥ 4 s) · `sky.meteor: true` — any terrain | |
| quiet, peaceful, lonely / magical / stormy | `mood` + `motion.budget` `calm` / `magical` / `dramatic` | |

Land terrains (`dunes`, `sea`, `jungle`, `ridges` alpine) can only change what README "Land
terrains" lists; check "Not expressible yet" before promising anything.

## 2. Write the JSON
- Start from the closest recipe's JSON in `art/scenes/` (copy, rename, change only what the sentence
  asks). `name`: 2–3 lower-case words from the sentence (`foggy_desert`); don't overwrite an
  existing file unless asked.
- **Only README values.** Prefer friendly words; numbers only inside the listed ranges.
- **Unsupported → nearest option**, decided in this order: (1) a supported value that keeps the
  sentence's intent (e.g. "lightning far away" on a sea → no lightning, stormy mood carried by surf
  and rain); (2) a different terrain that supports it, only if the subject survives; (3) leave it out.
  Record each one: asked → used → why.
- Validate: `node art/scripts/scene.mjs art/scenes/<name>.json` — fix every error in the JSON. Read the
  builder log: closest recipe, defaults, every rule it applied.

## 3. Pre-flight (before any render)
Write the plan (focal point, accent, depth planes, fog colour, where living things go, motion budget
target) and check it line by line against `rules.md`. Note which rules it caught.

## 4. Render, critique, fix — max 2 rounds
1. `art/scripts/reel.sh --scene art/scenes/<name>.json` (palette, static and motion checks).
2. Look at `art/out/_preview/<name>.png` (+ 2–4× crops of the focal point) and critique with the
   night-artist checks: one focal point = brightest contrast, one accent on light sources only,
   quiet fog, no crisp moon in rain, safe zones, motion budget vs target.
3. Fix the worst problem **in the JSON** and re-render. A round = one render you critique.
   **Stop after round 2** even if something is left; report it. If a fix needs code, don't make
   it — report it as a builder gap.

## 5. Save and report
Save the final JSON in `art/scenes/`. Report (no commit; commits follow approval):
- the sentence, the JSON path, the still (`art/out/reels/<name>.png`) and loop (`<name>_loop.mp4`)
- **what changed from the sentence and why**: every unsupported item (asked → used → why), every
  rule the builder or pre-flight applied (e.g. rain → no stars), every value you chose that the
  sentence didn't say
- rounds used, motion budget (measured vs target), what's left that only code could fix

## Known limits — say so up front, don't spend a round on them
| sentence asks | why | nearest |
|---|---|---|
| fireflies on desert, mountains, harbour | no near shore, bank or grass in those studies | leave out (say so) |
| heavy storm rain on `surf` | beach alone is 4.56%; heavy rain + gusts = 6.1% (rules: storms ≤ 5%) | `light` rain, no gusts, + `lightning` for the storm |
| "quiet" / no weather on a lake | only mist drift + twinkle move: ~0.04% | subtle by intent; don't add rain the sentence didn't ask for |
| objects outside the standard list (village, lamp post, jetty) | Phase 1 | leave out and ask the user (approval needed) |
| a lit full moon with a small light as focal | the moon (or a cloud lit by it) outshines the light | `moon.shape: "crescent"`, `hidden: false` (cloud goes to the far side) |
| land moon position, horizon, clouds | fixed by the study (README "Not expressible yet") | keep the study's |
Budget: storms are judged **without** the lightning flash frames (reel.sh prints both).
