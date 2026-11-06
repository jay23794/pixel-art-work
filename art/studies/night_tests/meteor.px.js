// test_meteor — night_tests: meteor(opts), one crossing per 4 s loop. Not a scene: a module test.
// A clear night over low hills. The path is 2:1 (regular 2-px runs, no jaggies); the still is
// frame 0, mid-crossing. Light: the moon upper right.
include("../../lib/night_sky.px.js")
include("../../lib/ridge.px.js")
include("../../lib/night_meteor.px.js")

var W = 360, H = 640
nightPalette("silver")
var K = nightKeys()
var SKY = nightSky({ horizon: 480, moon: { x: 296, y: 130 }, stars: { maxY: 380 }, clouds: { amount: 0 } })
var HILLS = ridgeProfile(W, { y: 480, amp: 24, scale: 70, seed: 9, octaves: 3 })
function hills(c) { for (var x = 0; x < W; x++) for (var y = HILLS[x]; y < H; y++) c.px(x, y, K(y === HILLS[x] && slopeAt(HILLS, x, 3) > 0.15 ? "r" : "R")) }
var MET = meteor({ from: [40, 112], to: [240, 212], frames: 48, at: 44, dur: 8 })

scene("test_meteor", { w: W, h: H, bg: K("U") }, ...SKY, hills, MET)
anim("test_meteor_loop", { w: W, h: H, frames: 48, fps: 12 }, ...SKY, hills, MET)
sprite("_test_meteor_loop_static", { w: W, h: H }, function (c) {
  c.rect(0, 440, W, H - 440, K("B"))                          // hills
  for (var dy = -20; dy <= 20; dy++) for (var dx = -20; dx <= 20; dx++) if (dx * dx + dy * dy <= 400) c.px(296 + dx, 130 + dy, K("B")) // moon
})
