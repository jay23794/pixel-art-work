# Recipes: the approved night scenes

Each recipe is a working scene in `art/studies/`. Copy its skeleton and settings; read the file for
details. All are 360×640, 12 fps. Motion budgets are what `reel.sh` measured.
(The five dusk + night studies are ports: their terrain draws in old keys and is remapped with
`nightRemap()`. New scenes don't need that: draw with `nightKeys()` directly.)

## mountains_night — `studies/mountains.px.js`
- **Modules:** nightSky; terrain: 4 ranges from `ridgeProfile` (sharp peaks), stamped `_land_` parts.
- **Settings:** horizon 282; moon (276, 124) upper right on the dusk sun's side; clouds scale 0.5 at
  (64, 170), top 96; stars default; twinkle n 7, maxY 170.
- **Accent:** silver (nothing but the moon). **Focal:** the hero peak's moonlit rim and snow.
- **Motion:** star twinkle only. **Cycle:** 24 f / 2 s. **Budget:** 0.0039% (subtle by intent).

## desert_night — `studies/desert.px.js`
- **Modules:** nightSky; far mesas, far plain, stamped land part (hero mesa, dunes).
- **Settings:** horizon 330; moon (262, 150); clouds 0.5 at (118, 150), top 96; twinkle n 7, maxY 280.
- **Accent:** silver. **Focal:** hero mesa on the left third, lit on its moon side.
- **Motion:** twinkle only. **Cycle:** 24 f. **Budget:** 0.0015% (subtle by intent).

## sea_night — `studies/sea.px.js`
- **Modules:** nightSky; sea rows, moon reflection column, wet/dry sand, foam, rocks (study code).
- **Settings:** horizon 286; moon low on the column axis (x = 252, y 216); clouds 0.5 at (80, 150);
  stars maxY 200; twinkle n 7, maxY 190.
- **Accent:** silver. **Focal:** the moon's reflection column on the water (right third).
- **Motion:** column shimmer, wave rows bob 1 px in turn, foam advances/retreats. **Cycle:** 24 f.
  **Budget:** 0.64% (calm).

## jungle_night — `studies/jungle.px.js`
- **Modules:** nightSky (moon in a canopy gap, clouds off), stamped foliage layers, fog bands,
  `lightBeam` shafts (`lift: [0, 0, 1]`), `fireflies()` defaults (10), vines.
- **Settings:** moon (268, 150) in the gap; shafts land on the clearing (162, 446).
- **Accent:** warm (fireflies only). **Focal:** the moonlit clearing under the shafts.
- **Motion:** fireflies (main), fog drift, shaft edges shimmer, vines sway. **Cycle:** 24 f.
  **Budget:** 0.42% (calm).

## harbour_night — `studies/harbour_night.px.js`
- **Modules:** nightSky (crescent, ring halo), cloud bank, hills, water, `cityLights`,
  `reflections` (moon glitter + 4 boats), window frame + sill (allowed exception).
- **Settings:** horizon = shore 342; crescent moon (98, 126), crescent (7, −5),
  `glow: { rings: [2.5, 5.5] }`; stars maxY 236, density 3.4; clouds amount 0; towers in `U`
  with a `B` edge; flicker 3%.
- **Accent:** warm (city, reflections, boats). **Focal:** downtown lights and their reflection.
- **Motion:** ~3% of lights burst once, reflections shimmer 1 px, boats drift 1 px, twinkle n 9.
  **Cycle:** 24 f. **Budget:** 0.12% (calm, quiet).

## beach_night — `studies/beach_night.px.js`
- **Modules:** nightSky (back layer stamped, stars per frame), streaming torn clouds, sea rows,
  `breakers` (2 spots), moon path, wash, wet/dry sand, dune with grass, starfish (exception).
- **Settings:** horizon 270; full moon (262, 150), `glow: { r: 18, ramp: 2 }`; stars maxY 200;
  wind blowing left; static mask: moon, starfish, dune face.
- **Accent:** silver. **Focal:** the moon path on the water, right third.
- **Motion:** waves break and wash up (main), clouds stream, grass bends in gusts, sand blows,
  twinkle n 8. **Cycle:** 48 f / 4 s. **Budget:** 4.56% (dramatic).

## lake_night — `studies/lake_night.px.js` (made with this skill, 4 rounds)
- **Modules:** nightSky (overcast, no stars, moon's lower half behind cloud), 2 ranges from
  `ridgeProfile`, flat still lake, `fog` drift (mist), `reflections` (the lamp, 3 columns),
  `ripples` light + ring, jetty + lamp post (exception), `lights` (1 point + deck pool), `rain`.
- **Settings:** horizon = shore 330; moon (272, 140), clouds 0.8 at (262, 166); lamp (96, 400) on
  the deck (y 470); mist top shore + 4, height 30, role `"L"`, `period: 180, drift: 90, dir: -1`;
  rain density 0.3, angle 0, ground 560; ring ripples cell [36, 14], rmax 9, keys `"hfF"`.
- **Accent:** warm (the lamp). **Focal:** the lamp and its broken warm column, left third.
- **Motion:** mist drifts left (1.25 px/frame), drizzle and ripples (`nightRepeat(…, 3)`),
  reflection shimmer; the lamp is steady. **Cycle:** 72 f / 6 s (12 s reel = 2 cycles).
  **Budget:** 0.80% (peaceful).

## Choosing
| brief has | start from |
|---|---|
| peaks, ranges, still air | mountains |
| open flat land, one landmark | desert |
| open water, moon path | sea |
| dense trees, light through a gap, small lights | jungle |
| far lights across water, a frame/view | harbour |
| waves, wind, shore | beach |
| a lake / still water with a near light | lake_night |
