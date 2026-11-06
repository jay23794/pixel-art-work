// test_rain — night_tests: rain(opts) over a flat field at night. Not a scene: a module test.
// Light: overcast; a faint moon glow behind the cloud deck upper right. Rain slants right (angle 1/4: 4-row runs),
// gusts sweep across once per loop; near drops land on the field, far ones end in the air.
include("../../lib/night_sky.px.js")
include("../../lib/night_rain.px.js")

var W = 360, H = 640, GROUND = 470
nightPalette("silver")
var K = nightKeys()
var SKY = nightSky({ horizon: GROUND, moon: { x: 270, y: 150 }, stars: false, clouds: { scale: 1.4, x: 250, y: 200, top: 96 } })
function field(c) {
  c.rect(0, GROUND, W, H - GROUND, K("R"))
  c.rect(0, GROUND, W, 1, K("b")) // far edge catching the moon
  for (var y = GROUND + 8; y < H; y += 6 + ((y - GROUND) >> 3)) c.rect(0, y, W, 1, K("r")) // furrows, wider apart nearer
}
var RAIN = rain({ angle: 0.25, wind: 0.5, ground: 600 })

scene("test_rain", { w: W, h: H, bg: K("U") }, ...SKY, field, RAIN)
anim("test_rain_loop", { w: W, h: H, frames: 24, fps: 12 }, ...SKY, field, RAIN)
// Below the landing line nothing falls.
sprite("_test_rain_loop_static", { w: W, h: H }, function (c) { c.rect(0, 602, W, H - 602, K("B")) })
