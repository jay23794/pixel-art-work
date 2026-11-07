// jungle — looking into a deep jungle: jungle_dusk, jungle_night (night kit: the same drawing under
// nightPalette("warm", "jungle_night") + nightSky, remapped to night_base; the moon behind the same
// canopy gap. At night the shafts are moonlight (kit lightBeam: haze/moon colours, not the leaves'
// teal) and the fireflies are the kit's, in the warm accent).
//
// Light: the low dusk sun behind a gap in the canopy, upper right (SUN). Its light comes down
// through the gap as stepped shafts onto one clearing (the focal point); leaf clusters and trunks
// are lit on the side facing it.
//
// Depth, back to front: sky in the gap → far masses (pale, foggy, no detail) → mid-far masses
// (blue-grey silhouettes) → fog bands → mid trees (green clusters, trunks) → clearing and ground →
// light shafts → near frame (dark canopy with the gap, big trunks, vines, ferns, litter).
include("../lib/land_jungle.px.js")

var LAND = landJungle()
LAND.define("dusk")
LAND.define("night")
