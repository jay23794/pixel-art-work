// harbour_night — showcase: a quiet night view through a window, across a dark bay toward a far
// city of warm lights. An original scene (no real city, landmark or bridge).
//
// Palette: night kit, nightPalette("warm", "harbour_night"): the frame, hills, clouds and water are
// drawn as before in the old harbour_night keys and remapped to night_base (nightRemap); the city
// lights, reflections and boats come from the kit (lib/night_city, lib/night_reflections) in the
// warm accent: 2 rust · 3 amber · 4 gold · 5 cream (brightest).
// Light: a crescent moon upper left (cool), lighting the cloud bank's top, the hills' rims and the
// window sill's edge. The city lights are their own sources (reflected straight down the water).
//
// Objects are allowed here only as: simple far buildings (dark, lit window dots), the window frame
// and sill (silhouettes). Boats only as light dots. Nothing on the right of the sill (kept free).
include("../palettes.px.js")
include("../lib/noise.px.js")
include("../lib/ridge.px.js")
include("../lib/dither.px.js")
include("../lib/sky.px.js")
include("../lib/night_sky.px.js")
include("../lib/night_city.px.js")
include("../lib/night_reflections.px.js")

var W = 360, H = 640
var SHORE = 342 // the far shore / waterline
var VIEW = { x0: 30, x1: 330, y0: 52, y1: 480, round: 46 } // window opening, rounded top-left
var SKY = {
  horizon: SHORE,
  moon: { x: 98, y: 126, crescent: { dx: 7, dy: -5 } },
  clouds: { amount: 0 },               // our own cloud bank instead
  stars: { maxY: 236, density: 3.4 },  // dense stars, kept high above the cloud bank
  glow: { rings: [2.5, 5.5] },         // two flat rings by true distance: even round the crescent
}
var MOON = nightLight(SKY)

// ---------------------------------------------------------------- cloud bank and hills

/**
 * Low cloud bank over the hills: a row of soft puffs; bands step from the moonlit top down into
 * the sky colour, with Bayer-dithered seams (a large, soft gradient). Only the puff tops facing
 * the moon (left) get the lit edge.
 */
var PUFFS = (function () {
  var out = [], x = -10
  while (x < W + 20) { var r = 10 + Math.round(hash2(64, x, 0) * 12); out.push([x, 282 - Math.round(hash2(64, x, 1) * 10), r]); x += Math.round(r * 1.3) }
  return out
})()
function cloudBank(c) {
  for (var x = 0; x < W; x++) {
    var top = 999, owner = null
    PUFFS.forEach(function (p) {
      var dx = x - p[0]
      if (Math.abs(dx) >= p[2]) return
      var t = p[1] - Math.sqrt(p[2] * p[2] - dx * dx) * 0.7
      if (t < top) { top = t; owner = p }
    })
    top = Math.round(top)
    for (var y = top; y < 318; y++) {
      var v = 1 - (y - top) / 34
      var k = rampKey(x, y, Math.max(0, v), "ULCc", 0.5)
      if (y === top && x < owner[0]) k = "l" // moonlit top on the moon's side of each puff
      c.px(x, y, k)
    }
  }
}

var HILLS_FAR = ridgeProfile(W, { y: 306, amp: 20, scale: 70, seed: 61, octaves: 3, shape: function (x) { return -10 * Math.exp(-Math.pow((x - 60) / 70, 2)) } })
var HILLS_NEAR = ridgeProfile(W, { y: 326, amp: 14, scale: 50, seed: 62, octaves: 3, shape: function (x) { return -8 * Math.exp(-Math.pow((x - 300) / 60, 2)) } })

/** Two low-contrast ranges; a 1 px moonlit rim where a slope faces the moon (left). */
function hills(c) {
  ;[[HILLS_FAR, "F", "f"], [HILLS_NEAR, "H", "F"]].forEach(function (h) {
    for (var x = 0; x < W; x++) {
      var top = h[0][x], faces = slopeAt(h[0], x, 3) > 0.15 // rising to the right = facing the moon
      for (var y = top; y < SHORE; y++) c.px(x, y, y === top && faces ? h[2] : h[1])
    }
  })
}

// ---------------------------------------------------------------- city
// The city lights (streets, houses, roads, towers, shopfronts, quay lamps) are the kit's
// cityLights() with its defaults (= this scene), towers in sky U with a B edge; see the scene below.

// ---------------------------------------------------------------- water

/** Dark bay with calm wave lines (perspective rows of short dashes, one step lighter). */
function water(c) {
  for (var y = SHORE; y < H; y++)
    for (var x = 0; x < W; x++) c.px(x, y, y === SHORE ? "j" : "J")
  for (var i = 0; i < 16; i++) {
    var t = i / 15, y = Math.round(SHORE + 4 + Math.pow(t, 1.6) * (VIEW.y1 - SHORE - 6)), x = -10, n = 0
    while (x < W) {
      var len = Math.round(3 + 12 * t * (0.5 + hash2(51, i, n))), gap = Math.round(4 + 20 * t * hash2(52, i, n) + 6 * hash2(53, i, n))
      if (hash2(54, i, n) > 0.3) c.rect(x, y, len, 1, "j")
      x += len + gap; n++
    }
  }
}

// ---------------------------------------------------------------- window frame

/** Inside the opening (rounded top-left corner)? */
function inView(x, y) {
  if (x < VIEW.x0 || x >= VIEW.x1 || y < VIEW.y0 || y >= VIEW.y1) return false
  var r = VIEW.round, cx = VIEW.x0 + r, cy = VIEW.y0 + r
  if (x < cx && y < cy && Math.hypot(x - cx, y - cy) > r) return false
  return true
}

var ROCK = "BRrbt", FLOOR = VIEW.y1 + 40 // sill top VIEW.y1..+13, apron under its lip, floor below

/**
 * Moonlight level 0..3 on the sill top and the floor: the opening's shape thrown down and to the
 * right (moon upper left), skewed 1 px per 2 rows. Hard steps: brightest near the window, fading
 * in steps toward the viewer; the edges sit a step lower. The far (bottom) end is the
 * image of the window's top, so it keeps the rounded corner on its left. The apron right under the
 * sill's lip stays in shadow.
 */
function moonlight(x, y) {
  if (y >= VIEW.y1 && y < VIEW.y1 + 11) { // sill top
    if (x < 12 || x >= W - 12) return 0
    var l = 56 + ((y - VIEW.y1) >> 1)
    return x < l ? 0 : x < l + 4 ? 1 : 2
  }
  var dy = y - FLOOR
  if (dy < 0 || dy >= 92) return 0
  var left = 92 + (dy >> 1), right = 304 + (dy >> 1)
  if (x < left || x >= right) return 0
  var lv = dy < 34 ? 2 : 1
  if (x < left + 5 || x >= right - 5) lv--
  var r = 26, cx = left + r, cy = 92 - r // rounded corner (left, far end)
  if (x < cx && dy > cy && Math.hypot(x - cx, dy - cy) > r) return 0
  return Math.max(0, lv)
}

/**
 * Interior: the wall and window frame around the view (almost black-blue), a faint inner bevel on
 * the frame, the thick sill at the bottom with a thin moonlit front edge, and the moonlight patch.
 * Texture only where light reaches: plank seams on the frame sides next to the opening, a lit inner
 * edge on the right reveal (it faces the moon), plank seams on the lit floor. Deep corners stay dark.
 */
function frame(c) {
  for (var y = 0; y < H; y++)
    for (var x = 0; x < W; x++) {
      if (inView(x, y)) continue
      var k = "B"
      // frame bevel: 2 px just outside the opening
      var near = false
      for (var d = 1; d <= 3 && !near; d++) near = inView(x + d, y) || inView(x - d, y) || inView(x, y + d) || inView(x, y - d)
      if (near && y < VIEW.y1) k = x === VIEW.x1 && y > 96 ? "r" : "R" // right reveal's inner edge catches the moon
      // plank seams on the frame sides, lit by the view; broken, and only clear of the corners
      else if (y > VIEW.y0 + 36 && y < VIEW.y1 - 8 && (x === 9 || x === 18 || x === W - 10 || x === W - 19) && hash2(95, x, y >> 3) > 0.25) k = "R"
      // sill: top surface, moonlit front edge, front face, shadow below
      if (y >= VIEW.y1 && y < VIEW.y1 + 14 && x >= 12 && x < W - 12) k = y === VIEW.y1 + 13 ? "t" : y > VIEW.y1 + 10 ? "b" : "r"
      else if (y >= VIEW.y1 + 14 && y < FLOOR && x >= 12 && x < W - 12) k = "R"
      var m = moonlight(x, y)
      if (m) {
        if (y >= FLOOR && x % 17 === 0) m-- // floor plank seams, a step darker
        k = ROCK[Math.min(3, ROCK.indexOf(k) + m)]
      }
      c.px(x, y, k)
    }
}

// ---------------------------------------------------------------- scene

nightPalette("warm", "harbour_night")
var CITY = cityLights({ shore: SHORE, ridge: HILLS_NEAR, keys: { tower: "U", edge: "B" } })
// Reflections: under every bright light, broken dashes dimming down the water; a moon glitter of
// cold-rim dashes; boat lights (dots with a short reflection, no boat shapes).
var REFL = reflections({ source: CITY, top: SHORE, moon: { x: MOON.x, y1: VIEW.y1, keys: ["N", "N"] },
  boats: [[72, 384, 0.9], [244, 368, 0.8], [292, 410, 1], [140, 428, 0.7]] })

/** Everything, at rest (p = null) or for one loop frame (p = c.phase). */
function harbourItems(animate) {
  function ph(c) { return animate ? c.phase || 0 : null }
  return [
    cloudBank,
    hills,
    water,
    function (c) { CITY(c, ph(c)) },
    function (c) { REFL(c, ph(c)) },
    frame,
    nightRemap(),
  ]
}

scene("harbour_night", { w: W, h: H, bg: "U" },
  ...nightSky(SKY),
  ...harbourItems(false),
)
// Seamless loop: 24 frames at 12 fps (2 s). ~3% of the city lights burst once (nightFlicker),
// reflections shimmer 1 px sideways, boat lights drift, a few stars twinkle. Frame, wall, moonlight
// patch and hills stay still.
anim("harbour_night_loop", { w: W, h: H, frames: 24, fps: 12 },
  ...nightSky(Object.assign({}, SKY, { motion: { twinkle: { n: 9, maxY: 236 } } })),
  ...harbourItems(true),
)
