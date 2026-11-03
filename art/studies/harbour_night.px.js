// harbour_night — showcase: a quiet night view through a window, across a dark bay toward a far
// city of warm lights. An original scene (no real city, landmark or bridge).
//
// Palette: the locked "harbour_night" palette (palettes.px.js): navy/teal everywhere; the only warm
// colours are the sand slots, used for the city lights and their reflections:
//   S ember · s amber · a gold · g cream (brightest)
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

var W = 360, H = 640
var SHORE = 342 // the far shore / waterline
var VIEW = { x0: 30, x1: 330, y0: 52, y1: 480, round: 46 } // window opening, rounded top-left
var SKY = {
  horizon: SHORE,
  moon: { x: 98, y: 126, crescent: { dx: 7, dy: -5 } },
  clouds: { x: -400, stratus: { hide: [0] } }, // our own cloud bank instead
  stars: { maxY: 236, density: 3.4 },           // dense stars, kept high above the cloud bank
  glow: { r: 0, ramp: 1 },                      // no ramp glow: moonHalo() draws an even, stepped one
}
var MOON = skyLight("night", SKY)

/**
 * Moon halo: two flat rings by true distance to the lit crescent pixels, so the steps stay even
 * all the way round, inner curve included. A ring only ever brightens the sky under it (U<D<d).
 */
function moonHalo(c) {
  var lit = [], R = MOON.r + 8, SKYK = "UDduk"
  for (var y = MOON.y - R; y <= MOON.y + R; y++)
    for (var x = MOON.x - R; x <= MOON.x + R; x++) if ("ONnow".indexOf(c.key(x, y)) >= 0) lit.push([x, y])
  for (var y = MOON.y - R; y <= MOON.y + R; y++)
    for (var x = MOON.x - R; x <= MOON.x + R; x++) {
      var cur = SKYK.indexOf(c.key(x, y))
      if (cur < 0) continue // moon or star pixel
      var d = 99
      lit.forEach(function (p) { d = Math.min(d, Math.hypot(x - p[0], y - p[1])) })
      var ring = d <= 2.5 ? 2 : d <= 5.5 ? 1 : 0
      if (ring > cur) c.px(x, y, SKYK[ring])
    }
}

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

/** Light density along the shore: a downtown peak in the middle, thinning out to the sides. */
function density(x) { return 0.12 + 0.88 * Math.exp(-Math.pow((x - 182) / 56, 2)) }

// Downtown towers: [x, width, top]. Dark shapes with a grid of lit window dots.
var TOWERS = [[150, 8, 304], [160, 12, 294], [174, 7, 300], [183, 10, 288], [195, 8, 298], [205, 12, 306], [220, 6, 314]]

/** A light's colour from its brightness 0..1. */
function lightKey(v) { return v > 0.93 ? "g" : v > 0.6 ? "a" : v > 0.25 ? "s" : "S" }

var LIGHTS = [] // { x, y, v } — collected for the reflections

/**
 * The city: lights on streets. Shore promenade and parallel streets climbing the near hills
 * (rows a few px apart, perspective-compressed), plus a few roads winding up the hills, all
 * thinning out with distance from downtown; towers downtown with window dots.
 */
function city(c, p) {
  LIGHTS = []
  function light(x, y, v) {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || x >= W || y < HILLS_NEAR[x] + 2) return
    v = flicker(x, y, v, p)
    c.px(x, y, lightKey(v))
    if (v > 0.85 && hash2(41, x, y) > 0.5) c.px(x + 1, y, lightKey(v * 0.8)) // a few 2-px lights
    LIGHTS.push({ x: x, y: y, v: v })
  }
  // Streets parallel to the shore.
  ;[0, 2, 4, 7, 10, 13, 17, 21].forEach(function (up, si) {
    var y = SHORE - 2 - up
    for (var x = 0; x < W; x += 2 + Math.round(hash2(42, si, x) * 2)) {
      var block = hash2(43, si, Math.floor(x / 14)) // dark blocks between streets
      if (block < 0.15) continue
      // brighter downtown: the brightness leans up with density
      if (hash2(44, si, x) < density(x) * (si === 0 ? 1.2 : 1.0 - si * 0.07)) light(x, y, Math.min(1, hash2(45, si, x) * (0.7 + 0.5 * density(x))))
    }
  })
  // Houses scattered along contour lines on the near hills, sparse.
  for (var i = 0; i < 70; i++) {
    var x = Math.floor(hash2(49, i, 0) * W), up = 4 + Math.floor(hash2(49, i, 1) * 3) * 4
    light(x, Math.max(HILLS_NEAR[x] + 3, SHORE - 24 - up), 0.15 + 0.5 * hash2(49, i, 2))
  }
  // Roads winding up the hills, lights every few px.
  ;[[60, SHORE - 3, 26, 310, 0.5], [292, SHORE - 3, 330, 316, 0.6], [120, SHORE - 6, 104, 318, 0.4]].forEach(function (r, ri) {
    for (var t = 0; t <= 1; t += 0.06) light(r[0] + (r[2] - r[0]) * t + 2 * Math.sin(t * 9), r[1] + (r[3] - r[1]) * t, r[4] * hash2(46, ri, t * 100))
  })
  // Towers.
  TOWERS.forEach(function (tw, ti) {
    c.rect(tw[0], tw[2], tw[1], SHORE - tw[2], "R")
    c.rect(tw[0], tw[2], 1, SHORE - tw[2], "B") // shadow edge away from the moon (right is lit side? moon left: left edge lit)
    for (var y = tw[2] + 2; y < SHORE - 3; y += 3)
      for (var x = tw[0] + 1; x < tw[0] + tw[1] - 1; x += 2)
        if (hash2(47, ti * 100 + x, y) < 0.32) { c.px(x, y, lightKey(flicker(x, y, 0.3 + 0.6 * hash2(48, x, y), p))); LIGHTS.push({ x: x, y: y, v: 0.5 }) }
  })
  // Street level downtown: lit shopfronts along the tower bases and the blocks between them.
  for (var x = 136; x < 236; x++) {
    var dd = density(x)
    if (hash2(65, x, 0) < 0.75 * dd) light(x, SHORE - 2, 0.55 + 0.45 * hash2(65, x, 1) * dd)
    if (hash2(65, x, 2) < 0.45 * dd) light(x, SHORE - 4, 0.4 + 0.5 * hash2(65, x, 3))
  }
  // Waterfront: a row of quay lamps right on the waterline, evenly spaced, denser downtown.
  for (var x = 4; x < W - 4; x += 3) if (hash2(66, x, 0) < 0.25 + 0.75 * density(x)) light(x, SHORE - 1, 0.62 + 0.38 * density(x) * hash2(66, x, 1))
}

/** Twinkle: about one light in twelve dims a step for part of the loop, each at its own phase. */
function flicker(x, y, v, p) {
  if (p === null || hash2(90, x, y) > 0.08) return v
  return Math.sin(2 * Math.PI * (p + hash2(91, x, y))) > 0.55 ? v * 0.55 : v
}

/** Sideways shimmer of a reflection dash: -1, 0 or +1 px, at its own phase. */
function shimmer(p, seed, a, b) {
  if (p === null) return 0
  var s = Math.sin(2 * Math.PI * (p + hash2(seed, a, b)))
  return s > 0.5 ? 1 : s < -0.5 ? -1 : 0
}

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

/**
 * Reflections: under every bright light, short broken vertical dashes running down the water,
 * dimming one warm step at a time; longer under the brightest. Faint silver glitter under the moon.
 */
function reflections(c, p) {
  LIGHTS.forEach(function (l, i) {
    if (l.v < 0.6 || l.y < SHORE - 14) return // only bright lights near the shore reflect
    var len = Math.round(10 + 60 * (l.v - 0.6) * (0.5 + hash2(55, i, 0))), y = SHORE + 3 + Math.round(hash2(56, i, 0) * 9), v = l.v * 0.75
    while (y < SHORE + len) {
      var dash = 1 + Math.round(hash2(57, i, y) * 2)
      if (hash2(58, i, y) > 0.25) c.rect(l.x + shimmer(p, 92, i, y), y, 1, dash, lightKey(v))
      y += dash + 1 + Math.round(hash2(59, i, y) * 3); v *= 0.88
    }
  })
  // moon glitter: a few cool dashes under the moon
  for (var y = SHORE + 6; y < VIEW.y1; y += 4) {
    var hw = 3 + (y - SHORE) * 0.12
    for (var k = 0; k < 2; k++) {
      var x = Math.round(MOON.x - hw + hash2(60, y, k) * 2 * hw)
      if (hash2(61, y, k) > 0.4) c.rect(x + shimmer(p, 93, y, k), y, 2 + Math.round(hash2(62, y, k) * 3), 1, k ? "N" : "O")
    }
  }
}

/** Boat lights: small warm dots on the water with a short reflection; no boat shapes. */
var BOATS = [[72, 384, 0.9], [244, 368, 0.8], [292, 410, 1], [140, 428, 0.7]]
function boats(c, p) {
  BOATS.forEach(function (b, bi) {
    var bx = b[0] + (p === null ? 0 : Math.round(Math.sin(2 * Math.PI * (p + bi / BOATS.length)))) // drifts ±1 px
    c.rect(bx, b[1], 2, 1, lightKey(b[2]))
    c.px(bx + 3, b[1] + 1, "S") // a second, dimmer light on the same boat
    for (var y = b[1] + 2; y < b[1] + 12; y += 3) if (hash2(63, bi, y) > 0.3) c.rect(bx + shimmer(p, 94, bi, y), y, 1, 2, lightKey(b[2] * 0.6))
  })
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

/** Everything, at rest (p = null) or for one loop frame (p = c.phase). */
function harbourItems(animate) {
  function ph(c) { return animate ? c.phase || 0 : null }
  return [
    moonHalo,
    cloudBank,
    hills,
    water,
    function (c) { city(c, ph(c)) },
    function (c) { reflections(c, ph(c)) },
    function (c) { boats(c, ph(c)) },
    frame,
  ]
}

palette("harbour_night")
scene("harbour_night", { w: W, h: H, bg: "U" },
  ...skyLayer("night", SKY),
  ...harbourItems(false),
)
// Seamless loop: 24 frames at 12 fps (2 s). City lights twinkle, reflections shimmer 1 px sideways,
// boat lights drift, a few stars twinkle. Frame, wall, moonlight patch and hills stay still.
anim("harbour_night_loop", { w: W, h: H, frames: 24, fps: 12 },
  ...skyLayer("night", Object.assign({}, SKY, { motion: { twinkle: { n: 9, maxY: 236 } } })),
  ...harbourItems(true),
)
