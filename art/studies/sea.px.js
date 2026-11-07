// sea — a calm open sea seen from a beach: sea_dusk, sea_night (night kit: nightPalette("silver",
// "night") + nightSky, the same drawing remapped to night_base; moon low on the sun's side so it
// throws the same reflection column).
//
// Light: the dusk sun of skyLayer("dusk"), half-sunk into a flat horizon at x 252. Wave tops catch
// its light (lit top edge), their undersides fall into shadow; its reflection runs straight down
// the water towards the viewer; the rock outcrop is lit on its sun side.
//
// Depth, back to front: sky → open water (reflects the sky: pale at the horizon, darker nearer),
// wave lines growing with distance → foam → wet sand mirroring the sky darker → dry sand.
include("../lib/land_sea.px.js")

var LAND = landSea()
LAND.define("dusk")
LAND.define("night")
