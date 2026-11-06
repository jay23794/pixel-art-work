// valley_night — a night valley: a winding river runs from the far mountains toward the viewer,
// reflecting a low crescent moon; thin fog in the valley between the ranges; a few fireflies along
// the near riverbank among dark grass; one meteor crosses the sky once per loop.
// Mood: magical, calm. Made with the night-artist skill (recipe: mountains backdrop + water glitter
// from reflections, fireflies from jungle; moods: magical + calm).
//
// Light: the low crescent moon in the notch of the far range (key light, centre): ridge rims and
// grass tips facing it are lit; its glitter runs down the river where the river passes under it.
// Palette: nightPalette("warm"): the fireflies only.
// Depth, back to front: sky (stars, meteor) → far range (sky keys) → valley fog → mid ranges
// (violet rock) → teal meadow → near slopes closing in from both sides (violet rock, moonlit rims)
// → river carving through (holds the sky: lightest far away) → bank grass, fireflies.
// Motion: one 6 s cycle (72 f): fog drifts, the river's light lines flow toward the viewer,
// fireflies wander and blink, the meteor crosses once, stars twinkle, the glitter shimmers.
include("../lib/night_sky.px.js")
include("../lib/ridge.px.js")
include("../lib/dither.px.js")
include("../lib/night_reflections.px.js")
include("../lib/night_fog.px.js")
include("../lib/night_fireflies.px.js")
include("../lib/night_meteor.px.js")

var W = 360, H = 640, FAR_Y = 300, FLOOR = 352
nightPalette("warm")
var K = nightKeys()
var NOTCH = 192
var SKY = { horizon: FAR_Y, moon: { x: NOTCH, y: 236, crescent: { dx: 7, dy: -5 } }, glow: { rings: [2.5, 5.5] },
  stars: { maxY: 210, density: 1.5 }, clouds: { amount: 0 } }
var MOON = nightLight(SKY)

// Far range with a notch over the river's source; mid ranges framing the valley on both sides.
var FAR = ridgeProfile(W, { y: FAR_Y, amp: 110, scale: 70, seed: 41, octaves: 3, sharp: 0.7,
  shape: function (x) { return 46 * Math.exp(-Math.pow((x - NOTCH) / 38, 2)) } })
var MID = ridgeProfile(W, { y: FLOOR, amp: 90, scale: 60, seed: 42, octaves: 3, sharp: 0.5,
  shape: function (x) { return 70 * Math.exp(-Math.pow((x - NOTCH) / 70, 2)) } })
// Near slopes: high at both edges, falling toward the river's line (the valley's V); the river
// carves through them.
var NEAR = ridgeProfile(W, { y: 470, amp: 26, scale: 50, seed: 43, octaves: 3,
  shape: function (x) { return -120 * Math.pow(Math.min(1, Math.abs(x - river(560).x) / 200), 1.4) + 20 } })

/** A range: body, and a lit rim where the slope faces the moon (descending toward its x). */
function range(p, bottom, body, rim) {
  return function (c) {
    for (var x = 0; x < W; x++) {
      var s = slopeAt(p, x, 3), lit = x < MOON.x ? s > 0.15 : s < -0.15
      for (var y = p[x]; y < bottom; y++) c.px(x, y, K(y === p[x] && lit ? rim : body))
    }
  }
}

// The river: centre line and width per row, narrow and straight far away, wide and winding near.
function river(y) {
  var t = Math.max(0, (y - FLOOR + 14) / (H - FLOOR + 14))
  return { x: NOTCH + 90 * t * Math.sin(t * 4.2 - 0.2), w: 3 + 120 * t * t + 18 * t }
}
function inRiver(x, y) { if (y < FLOOR - 12) return false; var r = river(y); return Math.abs(x - r.x) <= r.w / 2 }

/** Valley floor: a dark teal meadow, with a band of lighter grass where it meets the far fog. */
function meadow(c) {
  c.rect(0, FLOOR - 14, W, H - FLOOR + 14, K("H"))
  for (var x = 0; x < W; x++) c.rect(x, FLOOR - 14, 1, 6 + Math.round(3 * Math.sin(x / 17)), K("F"))
}

/** Near slopes, lit on the rims that face the moon. */
function slopes(c) { range(NEAR, H, "R", "r")(c) }

/**
 * The river holding the sky: lightest far, darker near; calm light lines that flow toward the viewer
 * (loops: 30 rows per cycle, 0.4 px/frame; each line keeps its own x as it moves).
 */
function valley(c, flow) {
  var shift = Math.round((flow || 0) * 30)
  for (var y = FLOOR - 12; y < H; y++) {
    var r = river(y), t = (y - FLOOR + 12) / (H - FLOOR + 12)
    for (var x = Math.floor(r.x - r.w / 2); x <= r.x + r.w / 2; x++) c.px(x, y, K(rampKey(x, y, 1 - t, "Ddu", 0.3)))
    var line = y - shift
    if (((line % 5) + 5) % 5 === 0 && r.w > 10) c.rect(Math.round(r.x - r.w * 0.3 + hash2(51, line, 0) * r.w * 0.3), y, Math.max(2, Math.round(r.w * 0.15)), 1, K("u"))
  }
}

/** Dark grass along the near banks: blades leaning a little, tips lit on the moon's side. */
var BLADES = (function () {
  var out = []
  for (var i = 0; i < 260; i++) {
    var y = 470 + Math.floor(hash2(61, i, 0) * 150), r = river(y), side = hash2(61, i, 1) < 0.5 ? -1 : 1
    var x = Math.round(r.x + side * (r.w / 2 + 2 + hash2(61, i, 2) * 40))
    out.push({ x: x, y: y, h: 4 + Math.floor(hash2(61, i, 3) * 8 * (y - 440) / 180), lean: hash2(61, i, 4) < 0.5 ? -1 : 1 })
  }
  return out.sort(function (a, b) { return a.y - b.y })
})()
function grass(c) {
  BLADES.forEach(function (b) {
    for (var k = 0; k < b.h; k++) {
      var x = b.x + (k > b.h / 2 ? b.lean : 0), lit = k === b.h - 1 && (b.x < MOON.x ? b.lean > 0 : b.lean < 0)
      c.px(x, b.y - k, K(lit ? "h" : k > b.h / 2 ? "f" : "F"))
    }
  })
}

var GLITTER = reflections({ source: [], top: FLOOR - 12, moon: { x: MOON.x, y1: H, keys: ["n", "N"] } })
var MIST = fog({ top: FAR_Y - 4, height: 36, role: "C", amp: 5, motion: "drift", period: 180, drift: 90 })
// Over the bank grass: left bank (the near one, wider) and right bank, just off the water.
var FLIES = fireflies({ count: 8, near: [150, 500, 44, 46], far: [262, 470, 26, 40], path: { ax: [5, 6], ay: [3, 3] } })
var METEOR = meteor({ from: [40, 96], to: [200, 176], frames: 72, at: 68, dur: 8 })

function items(animate) {
  var sky = animate ? Object.assign({}, SKY, { motion: { twinkle: { n: 16, maxY: 200 } } }) : SKY
  return [
    ...nightSky(sky), METEOR, range(FAR, H, "D", "d"), MIST, range(MID, H, "r", "b"), meadow, slopes,
    function (c) { valley(c, animate ? c.phase : 0) },
    clip(inRiver, function (c) { GLITTER(c, animate ? c.phase : null) }),
    grass, animate ? nightRepeat(FLIES, 2) : FLIES,
  ]
}
scene("valley_night", { w: W, h: H, bg: K("U") }, ...items(false))
anim("valley_night_loop", { w: W, h: H, frames: 72, fps: 12 }, ...items(true))
// The moon disk and the valley floor away from the river, grass and fireflies never move.
sprite("_valley_night_loop_static", { w: W, h: H }, function (c) {
  for (var dy = -18; dy <= 18; dy++) for (var dx = -18; dx <= 18; dx++) if (dx * dx + dy * dy <= 324) c.px(MOON.x + dx, MOON.y + dy, K("B"))
  for (var y = FLOOR; y < 460; y++) for (var x = 0; x < W; x++) if (!inRiver(x, y) && y >= MID[x] && y < NEAR[x] - 12) c.px(x, y, K("B"))
})
