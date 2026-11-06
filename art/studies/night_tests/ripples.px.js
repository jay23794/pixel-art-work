// test_ripples — night_tests: ripples(opts) in both modes. Not a scene: a module test.
// A far bank of warm lights over dark water: their reflections (reflections()) are broken up by
// "light" ripples. On the near wet ground, puddles take "ring" ripples (stepped rings that fade
// into dashes). Light: the moon upper left; the bank lights are their own sources.
include("../../lib/night_sky.px.js")
include("../../lib/night_city.px.js")
include("../../lib/night_reflections.px.js")
include("../../lib/night_ripples.px.js")

var W = 360, H = 640, SHORE = 330, BANK = 300, WET = 452
nightPalette("warm")
var K = nightKeys()
var SKY = nightSky({ horizon: SHORE, moon: { x: 80, y: 150 }, stars: { maxY: 220 }, clouds: { amount: 0 } })
var RIDGE = []
for (var x = 0; x < W; x++) RIDGE.push(BANK + Math.round(4 * Math.sin(x / 37) + 3 * Math.sin(x / 13)))
var CITY = cityLights({ shore: SHORE, ridge: RIDGE, towers: [], roads: [], houses: 30, streets: [0, 2, 5, 9], shops: [120, 240] })
var REFL = reflections({ source: CITY, top: SHORE })
var PUDDLES = [[90, 520, 52, 10], [250, 500, 40, 7], [190, 590, 70, 14]] // x, y, rx, ry
function inPuddle(x, y) {
  return PUDDLES.some(function (p) { var dx = (x - p[0]) / p[2], dy = (y - p[1]) / p[3]; return dx * dx + dy * dy <= 1 })
}
function land(c) {
  for (var x = 0; x < W; x++) c.rect(x, RIDGE[x], 1, SHORE - RIDGE[x], K("B"))
  c.rect(0, SHORE, W, WET - SHORE, K("H"))                      // dark water
  c.rect(0, WET, W, H - WET, K("R"))                            // wet ground
  c.rect(0, WET, W, 1, K("r"))
  for (var y = WET; y < H; y++) for (var x = 0; x < W; x++) if (inPuddle(x, y)) c.px(x, y, K("F")) // puddles hold the sky
}
var RIPW = ripples({ area: [100, SHORE + 3, 170, 50], mode: "light", cell: [18, 8], rmax: 9, life: 0.5, per: 2 })
var RIPP = ripples({ area: [20, WET + 30, 320, 150], mask: inPuddle, cell: [22, 8], rmax: 11, life: 0.5, per: 2, keys: "nlC" })

scene("test_ripples", { w: W, h: H, bg: K("U") }, ...SKY, land, function (c) { CITY(c, null) }, function (c) { REFL(c, null) }, RIPW, RIPP)
anim("test_ripples_loop", { w: W, h: H, frames: 24, fps: 12 }, ...SKY, land,
  function (c) { CITY(c, null) }, function (c) { REFL(c, c.phase) }, RIPW, RIPP)
// Sky, bank and the dry part of the ground never move.
sprite("_test_ripples_loop_static", { w: W, h: H }, function (c) {
  c.rect(0, 0, W, BANK - 10, K("B"))
  for (var y = WET; y < H; y++) for (var x = 0; x < W; x++) {
    var near = false
    PUDDLES.forEach(function (p) { var dx = (x - p[0]) / (p[2] + 3), dy = (y - p[1]) / (p[3] + 3); if (dx * dx + dy * dy <= 1) near = true })
    if (!near) c.px(x, y, K("B"))
  }
})
