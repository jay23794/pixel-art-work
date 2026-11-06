// test_fog — night_tests: fog(opts) between two ranges. Not a scene: a module test.
// Light: the moon upper right. Far range dark blue (low contrast), mid range in violet rock; the fog sits in the
// valley between them (two veils that turn the rock cool, a solid haze band at the bottom) and
// sways (test_fog_drift_loop: drifts one way, one 6 s cycle); the near ground covers its foot.
include("../../lib/night_sky.px.js")
include("../../lib/ridge.px.js")
include("../../lib/night_fog.px.js")

var W = 360, H = 640
nightPalette("silver")
var K = nightKeys()
var SKY = nightSky({ horizon: 420, moon: { x: 276, y: 140 }, stars: { maxY: 240 }, clouds: { amount: 0 } })
var FAR = ridgeProfile(W, { y: 360, amp: 40, scale: 80, seed: 3, octaves: 3 })
var MID = ridgeProfile(W, { y: 430, amp: 30, scale: 60, seed: 4, octaves: 3 })
var NEAR = ridgeProfile(W, { y: 532, amp: 10, scale: 50, seed: 5, octaves: 2 })
function range(prof, body, rim, bottom) {
  return function (c) {
    for (var x = 0; x < W; x++) {
      var lit = slopeAt(prof, x, 3) > 0.15 // rising to the right faces the moon
      for (var y = prof[x]; y < bottom; y++) c.px(x, y, y === prof[x] && lit ? K(rim) : K(body))
    }
  }
}
var FOG = fog({ top: 440, height: 100, role: "haze", amp: 9, sway: 6 })

var ITEMS = [...SKY, range(FAR, "D", "d", H), range(MID, "r", "b", H), FOG, range(NEAR, "R", "r", H)]
scene("test_fog", { w: W, h: H, bg: K("U") }, ...ITEMS)
anim("test_fog_loop", { w: W, h: H, frames: 24, fps: 12 }, ...ITEMS)
sprite("_test_fog_loop_static", { w: W, h: H }, function (c) { c.rect(0, 0, W, 395, K("B")); c.rect(0, 545, W, H - 545, K("B")) })

// Drift: the same fog moving one way: one 6 s cycle (72 frames, pxl's longest 360×640 anim), 90 px
// per loop = 1.25 px/frame (cross-faded copies, seamless); a 12 s reel is two cycles.
var FOG_DRIFT = fog({ top: 440, height: 100, role: "haze", amp: 9, motion: "drift", period: 180, drift: 90 })
anim("test_fog_drift_loop", { w: W, h: H, frames: 72, fps: 12 },
  ...SKY, range(FAR, "D", "d", H), range(MID, "r", "b", H), FOG_DRIFT, range(NEAR, "R", "r", H))
sprite("_test_fog_drift_loop_static", { w: W, h: H }, function (c) { c.rect(0, 0, W, 395, K("B")); c.rect(0, 545, W, H - 545, K("B")) })
