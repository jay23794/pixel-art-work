// desert — a wide desert: desert_dusk, desert_night (night kit: nightPalette("silver", "night") +
// nightSky, the same drawing remapped to night_base; moon on the sun's side).
//
// Light: the dusk sun of skyLayer("dusk"), sinking into the heat haze at x 252. Faces turned
// towards it are lit (the mesa's right side, dune faces on the sun's side of each crest); faces
// turned away are in shadow; shadows of pebbles fall flat along the ground away from it.
//
// Depth, back to front: sky → far mesas (pale, cool, no outline) → stepped heat-haze bands on the
// far plain → HERO mesa (left third) with talus → dunes D1..D4, darkest and warmest at the front.
include("../lib/land_desert.px.js")

var LAND = landDesert()
LAND.define("dusk")
LAND.define("night")
