// mountains — a layered range: mountains_dusk (approved), mountains_night (night kit: the same
// drawing under nightPalette("silver", "night") + nightSky, remapped to night_base; no redrawing).
//
// Light: the low dusk sun of skyLayer("dusk"), set in a notch between the ranges (x 252).
// Faces that turn towards the sun's side are lit, faces that turn away are in shadow; each face is
// split from the next along its spine (the ridge running down from a peak) and its gullies.
//
// Depth, back to front: R1 far (low, gentle) → R2 → R3 (snow) → HERO (snow, strata, cracks)
// → foreground lip. Each range back is paler, cooler and lower contrast; stepped haze bands
// sit at the foot of each range. Only the hero has an outline (broken on lit edges).
include("../lib/land_mountains.px.js")

var LAND = landMountains()
LAND.define("dusk")
LAND.define("night")
