// beach_night — a windy beach at night under a bright full moon: torn clouds stream past the moon,
// two waves break and wash up the sand, the dune grass bends in the wind, a starfish lies on the dune.
//
// Light: the full moon upper right (MOON). Cloud edges, grass blades and the starfish are lit on the
// side facing it; its silver path runs down the water to the shore (the focal point, right third)
// and carries on faintly in the wet sand. The wave faces turn away from it (backlit, dark) with
// bright crests; the near dune faces the viewer, away from the moon, so it stays dark.
// Palette: night kit, nightPalette("silver", "beach_night"): drawn in the old beach_night keys and
// remapped to night_base (nightRemap). The starfish (old coral F f z) becomes ground S s a: accents
// are for light sources only.
// Wind: from the right, blowing LEFT. Clouds, grass and blown sand all lean that way.
//
// Depth, back to front: sky → open sea (wave rows growing toward the beach) → two breakers →
// foam wash → wet sand → dry sand → dune lip with grass and the starfish → dune face (bottom safe zone).
include("../lib/land_beach_night.px.js")

var LAND = landBeach()
LAND.define("night")
