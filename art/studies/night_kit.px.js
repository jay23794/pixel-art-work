// night_kit — test sheet for lib/night_lights.px.js (not a scene): the same lights under each
// accent. Sky (kit nightSky, no clouds) over a flat dark ground. Three point lights (5-ring stepped
// glow, widening spacing), a pool under each on the ground, and a slab with lit windows of growing
// size (bigger panes get dimmer keys). The loops use a high flicker rate (40%) so bursts are easy
// to see; real scenes keep the default 3%.
// Light: the moon upper right; the point lights are their own sources.
include("../lib/night_sky.px.js")
include("../lib/night_lights.px.js")

var W = 360, H = 640, GROUND = 400
var POINTS = [[70, 320], [180, 300], [290, 320]]
var WINDOWS = [[44, 540, 1, 1], [58, 540, 2, 1], [72, 538, 2, 3], [90, 536, 4, 4], [112, 534, 6, 5], [138, 530, 10, 8],
  [170, 540, 1, 1], [184, 538, 2, 2], [200, 536, 3, 4], [222, 534, 5, 6], [246, 530, 12, 10], [280, 532, 8, 8], [306, 538, 3, 2]]

function ground(K) {
  return function (c) {
    c.rect(0, GROUND, W, H - GROUND, K("R"))
    c.rect(0, GROUND, W, 1, K("r"))         // moonlit edge of the far ground
    c.rect(30, 524, 300, 26, K("B"))        // slab the windows sit in
  }
}

function kit(accent) {
  nightPalette(accent)
  var K = nightKeys(), sky = nightSky({ horizon: GROUND, moon: { x: 300, y: 130 }, clouds: { amount: 0 }, stars: { maxY: 220 } })
  function L(animate) {
    return lights({
      points: POINTS.map(function (p) { return { x: p[0], y: p[1] } }),
      pools: POINTS.map(function (p) { return { x: p[0], y: 450, rx: 44, ry: 10 } }),
      windows: WINDOWS.map(function (w) { return { x: w[0], y: w[1], w: w[2], h: w[3] } }),
      flicker: { rate: 0.4, frames: 24 },
      animate: animate,
    })
  }
  scene("night_kit_" + accent, { w: W, h: H, bg: K("U") }, ...sky, ground(K), ...L(false))
  anim("night_kit_" + accent + "_loop", { w: W, h: H, frames: 24, fps: 12 }, ...sky, ground(K), ...L(true))
}

kit("warm")
kit("neon")
kit("silver")
