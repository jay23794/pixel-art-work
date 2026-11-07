// harbour_night — showcase: a quiet night view through a window, across a dark bay toward a far
// city of warm lights. An original scene (no real city, landmark or bridge).
//
// Palette: night kit, nightPalette("warm", "harbour_night"): the frame, hills, clouds and water are
// drawn as before in the old harbour_night keys and remapped to night_base (nightRemap); the city
// lights, reflections and boats come from the kit (lib/night_city, lib/night_reflections) in the
// warm accent: 2 rust · 3 amber · 4 gold · 5 cream (brightest).
// Light: a crescent moon upper left (cool), lighting the cloud bank's top, the hills' rims and the
// window sill's edge. The city lights are their own sources (reflected straight down the water).
//
// Objects are allowed here only as: simple far buildings (dark, lit window dots), the window frame
// and sill (silhouettes). Boats only as light dots. Nothing on the right of the sill (kept free).
include("../lib/land_harbour_night.px.js")

var LAND = landHarbour()
LAND.define("night")
