// test_lightning — night_tests: lightning(opts), one strike per 4 s loop. Not a scene: a module test.
// An overcast night over flat land; the strike plays NIGHT_LIGHTNING_PATTERN from frame 0 (so the
// still shows the first flash): sky one step up, bolt, cooling channel, return stroke.
// Light: the flash lights the sky only; the ground stays dark.
include("../../lib/night_sky.px.js")
include("../../lib/night_lightning.px.js")

var W = 360, H = 640, GROUND = 430
nightPalette("silver")
var K = nightKeys()
var SKY = nightSky({ horizon: GROUND, moon: { x: -100, y: -100 }, glow: false, stars: false,
  clouds: { scale: 1.2, x: 200, y: 260, top: 96 } })
function ground(c) { c.rect(0, GROUND, W, H - GROUND, K("R")); c.rect(0, GROUND, W, 1, K("r")) }
var BOLT = lightning({ frames: 48, at: 0, horizon: GROUND, bolt: { from: [176, 214], to: [214, GROUND - 1] } })

scene("test_lightning", { w: W, h: H, bg: K("U") }, ...SKY, ground, BOLT)
anim("test_lightning_loop", { w: W, h: H, frames: 48, fps: 12 }, ...SKY, ground, BOLT)
sprite("_test_lightning_loop_static", { w: W, h: H }, function (c) { c.rect(0, GROUND + 3, W, H - GROUND - 3, K("B")) })
