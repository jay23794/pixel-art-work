// lake_night — a rainy night lake: still dark water, mountains behind, one lone lamp post on a
// small wooden jetty on the left; its warm light reflected and broken by rain ripples; mist low
// over the water. Mood: lonely, peaceful. Made with the night-artist skill (recipe: lake = sea
// water + harbour reflections + mountain backdrop).
//
// Light: the moon upper right, its lower half behind rain cloud (key light: ridges and the post's right
// edges are lit from the right). The lamp is the only other source and the focal point (left third).
// Palette: nightPalette("warm"): the lamp, its rings, the pool on the deck and its reflection.
// Depth, back to front: overcast sky → far range (sky keys) → near range (violet rock) → lake
// (still, dark) → mist low over the far water → reflection + ripples → jetty, post,
// lamp → rain.
// Motion: one 6 s cycle (72 f): the mist drifts one way; rain and ripples repeat their 2 s loops
// inside it (nightRepeat); the reflection shimmers. The lamp is steady (peaceful).
include("../lib/night_sky.px.js")
include("../lib/ridge.px.js")
include("../lib/night_reflections.px.js")
include("../lib/night_ripples.px.js")
include("../lib/night_fog.px.js")
include("../lib/night_rain.px.js")

var W = 360, H = 640, SHORE = 330, DECK = 470
var LAMP = { x: 96, y: 400 }
nightPalette("warm")
var K = nightKeys()
var SKY = { horizon: SHORE, moon: { x: 272, y: 140 }, stars: false, clouds: { scale: 0.8, x: 262, y: 166, top: 96 } }
var MOON = nightLight(SKY)

var FAR = ridgeProfile(W, { y: SHORE, amp: 120, scale: 70, seed: 21, octaves: 3, sharp: 0.7 })
var NEAR = ridgeProfile(W, { y: SHORE, amp: 78, scale: 55, seed: 22, octaves: 3, sharp: 0.6 })

/** A range: body key, lit rim where the slope faces the moon (rising to the right). */
function range(p, body, rim) {
  return function (c) {
    for (var x = 0; x < W; x++) {
      var lit = slopeAt(p, x, 3) > 0.15
      for (var y = p[x]; y < SHORE; y++) c.px(x, y, K(y === p[x] && lit ? rim : body))
    }
  }
}

/** Still lake: dark teal with a few long calm lines (no mirror: the mist hides the shore). */
function lake(c) {
  c.rect(0, SHORE, W, H - SHORE, K("H"))
  c.rect(0, SHORE, W, 1, K("f")) // the far shore line catching the sky
  for (var i = 0; i < 9; i++) {
    var y = SHORE + 60 + Math.round(Math.pow(i / 8, 1.5) * 220), x = Math.round(hash2(31, i, 0) * 200), len = 30 + Math.round(hash2(31, i, 1) * 90)
    c.rect(x + 120, y, len, 1, K("F"))
  }
}

/** Jetty: deck from the left edge (top lit by the moon, dark front), pilings into the water. */
function jetty(c) {
  c.rect(0, DECK, 112, 2, K("s"))  // deck top
  c.rect(0, DECK + 2, 112, 4, K("S"))  // deck front
  c.rect(0, DECK + 6, 112, 1, K("A"))  // under the lip
  ;[6, 36, 66, 104].forEach(function (x) { c.rect(x, DECK + 7, 3, 16, K("B")); c.px(x + 2, DECK + 7, K("R")) })
}

/** Lamp post on the jetty end: a 2 px pole (lit edge right), a small head with a glass pane. */
function post(c) {
  c.rect(LAMP.x - 1, LAMP.y + 4, 2, DECK - LAMP.y - 4, K("B"))
  c.rect(LAMP.x, LAMP.y + 4, 1, DECK - LAMP.y - 4, K("R"))
  c.rect(LAMP.x - 3, LAMP.y - 3, 7, 1, K("B"))   // cap
  c.rect(LAMP.x - 3, LAMP.y + 3, 7, 1, K("B"))   // base of the head
}

var LIGHT = lights({ points: [{ x: LAMP.x, y: LAMP.y, radii: [1, 2, 4, 7, 11] }], pools: [{ x: LAMP.x - 8, y: DECK + 1, rx: 18, ry: 1 }] })
var REFL = reflections({ source: [{ x: LAMP.x - 1, y: LAMP.y, v: 1.1 }, { x: LAMP.x, y: LAMP.y, v: 1.4 }, { x: LAMP.x + 1, y: LAMP.y, v: 1.1 }],
  top: DECK + 6, near: 90 })
var MIST = fog({ top: SHORE + 4, height: 30, role: "L", amp: 4, motion: "drift", period: 180, drift: 90, dir: -1 }) // 1.25 px/frame
var RIP_LIGHT = ripples({ area: [LAMP.x - 22, DECK + 8, 44, 70], mode: "light", cell: [14, 8], rmax: 9, life: 0.5 })
var RIP = ripples({ area: [120, DECK + 4, 240, 86], cell: [36, 14], rmax: 9, keys: "hfF", life: 0.5 })
var RAIN = rain({ angle: 0, density: 0.3, ground: 560 })

function items(animate) {
  function rep(item) { return animate ? nightRepeat(item, 3) : item }
  return [
    ...nightSky(SKY), range(FAR, "D", "d"), range(NEAR, "r", "b"), lake, MIST,
    function (c) { REFL(c, animate ? c.phase : null) },
    rep(RIP_LIGHT), rep(RIP), jetty, ...LIGHT, post, rep(RAIN), // post after its light: the head frames the glow
  ]
}
scene("lake_night", { w: W, h: H, bg: K("U") }, ...items(false))
anim("lake_night_loop", { w: W, h: H, frames: 72, fps: 12 }, ...items(true))
// Below the rain's landing line and the ripples nothing moves.
sprite("_lake_night_loop_static", { w: W, h: H }, function (c) { c.rect(0, 566, W, H - 566, K("B")) })

