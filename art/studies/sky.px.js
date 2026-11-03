// sky — the four times of day: sky_sunrise, sky_day, sky_dusk, sky_night.
// One generator (art/lib/sky.px.js), four palettes (same keys; palette swap per time of day).
// Light: the sun (or moon) of each scene is the single light source; every cloud's lit edge
// faces it and its underside turns away from it.
//   sunrise: low, left    day: high, upper right    dusk: low, right    night: moon, upper left
// Approved: dusk, night. Sunrise and day need a fix pass before any scene uses them.
include("../palettes.px.js")
include("../lib/sky.px.js")

function skyScene(time) {
  palette(time)
  scene("sky_" + time, { w: 360, h: 640, bg: "U" }, ...skyLayer(time))
}

skyScene("sunrise")
skyScene("day")
skyScene("dusk")
skyScene("night")
