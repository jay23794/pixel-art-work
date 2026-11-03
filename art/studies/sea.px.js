// sea — a calm open sea seen from a beach: sea_dusk, sea_night (pure palette swap +
// skyLayer("night"), moon low on the sun's side so it throws the same reflection column).
//
// Light: the dusk sun of skyLayer("dusk"), half-sunk into a flat horizon at x 252. Wave tops catch
// its light (lit top edge), their undersides fall into shadow; its reflection runs straight down
// the water towards the viewer; the rock outcrop is lit on its sun side.
//
// Depth, back to front: sky → open water (reflects the sky: pale at the horizon, darker nearer),
// wave lines growing with distance → foam → wet sand mirroring the sky darker → dry sand.
include("../palettes.px.js")
include("../lib/noise.px.js")
include("../lib/dither.px.js")
include("../lib/sky.px.js")

var W = 360, H = 640
var HORIZON = 286
// Cumulus to the upper left; the two stratus bands above the sun and its reflection are dropped.
var SKY = { horizon: HORIZON, clouds: { scale: 0.6, top: 96, x: 90, y: 160, stratus: { hide: [0, 2] } } }
var SUN = skyLight("dusk", SKY)
var LIGHT_X = SUN.x // the reflection column's axis (sun at dusk, moon at night: same x)
// Night: the moon low (y 216) on the sun's axis, so it throws the same column, in silver; the
// cumulus to the upper left, away from the column.
var SKY_OPTS = {
  dusk: SKY,
  night: { horizon: HORIZON, moon: { x: LIGHT_X, y: 216 }, clouds: { scale: 0.5, top: 96, x: 80, y: 150 } },
}
var SHORE = 452 // where the waves end in foam
var WET = 490   // wet sand gives way to dry sand (lower under the rocks, which stand in the wet)

// Sky-ramp steps for the water: up = one step lighter, down = one step darker.
var UP = { U: "D", D: "d", d: "u", u: "k", k: "k" }, DOWN = { k: "u", u: "d", d: "D", D: "U", U: "U" }

/**
 * Motion state for loops. Stills use STILL (everything at rest); anims build one per frame from
 * c.phase, so every offset is a sin of the loop phase and frame 23 flows into frame 0.
 */
var STILL = { on: false, p: 0 }
function motion(c) { return { on: true, p: c.phase || 0 } }
function bob(m, i) { return m.on && Math.sin(2 * Math.PI * (m.p + i * 0.11)) > 0 ? 1 : 0 } // wave rows roll in
function foamShift(m) { return m.on ? Math.round(3 * Math.sin(2 * Math.PI * m.p)) : 0 }     // advance / pull back

/** Water reflects the sky: pale near the horizon (reflecting the low sky), darker nearer. */
function waterKey(x, y) {
  var v = (y - HORIZON) / (SHORE - HORIZON)
  // shallow water near the shore stops at plum (sand shows through), never the darkest sky colour
  return rampKey(x, y, 1 - Math.min(1, v) * 0.66, "UDdu", 0.4)
}

/** Reflection column half-width at y: narrow at the horizon, widening towards the viewer. */
function columnHalf(y) { return 4 + (y - HORIZON) * 0.3 }
function inColumn(x, y, pad) { return Math.abs(x - LIGHT_X) < columnHalf(y) + (pad || 0) }

/** Wet line under each column: the rocks' end of the beach stays wet further down. */
function wetLine(x) {
  var under = x < 124 ? Math.round(16 * Math.min(1, (124 - x) / 20)) : 0
  return WET + Math.round(2 * Math.sin(x / 31)) + under
}

/** Wave rows, perspective-spaced: tight and thin near the horizon, wide and bold near the shore. */
function waveRows() {
  var rows = [], N = 18
  for (var i = 0; i < N; i++) {
    var t = i / (N - 1)
    rows.push({ y: Math.round(HORIZON + 3 + Math.pow(t, 1.7) * (SHORE - HORIZON - 10)), t: t, i: i })
  }
  return rows
}
var ROWS = waveRows()

/**
 * Long swells in the side water: a few gently arched lines of uneven length and spacing, so the
 * open water isn't just regular dashes. Lit top, shadow under once they're near enough.
 */
var SWELLS = (function () {
  var out = []
  for (var j = 0; j < 10; j++) {
    var t = 0.25 + 0.75 * hash2(66, j, 0), y = Math.round(HORIZON + 3 + Math.pow(t, 1.7) * (SHORE - HORIZON - 10)) + 3
    var len = Math.round(30 + 90 * t * (0.6 + 0.6 * hash2(66, j, 1)))
    var left = hash2(66, j, 2) < 0.5
    var x0 = left ? Math.round(hash2(66, j, 3) * Math.max(10, LIGHT_X - columnHalf(y) - len - 8)) - 10
                  : Math.round(LIGHT_X + columnHalf(y) + 8 + hash2(66, j, 3) * 60)
    out.push({ x0: x0, y: y, len: len, t: t, row: Math.round(t * 17) })
  }
  return out
})()

function sea(c, m) {
  for (var y = HORIZON; y < SHORE + 16; y++)
    for (var x = 0; x < W; x++) c.px(x, y, waterKey(x, y))

  ROWS.forEach(function (row) {
    var t = row.t, x = Math.floor(hash2(61, row.i, 0) * 20) - 20, n = 0, dy = bob(m, row.i)
    while (x < W) {
      var len = Math.round(3 + 16 * Math.pow(t, 1.1) * (0.5 + hash2(61, row.i, n)))
      var gap = Math.round(3 + 26 * t * (0.4 + hash2(62, row.i, n)) + (t < 0.3 ? 4 * hash2(63, row.i, n) : 0))
      var skip = (t < 0.3 && hash2(64, row.i, n) < 0.35) ||                       // far rows: sparser
        (t >= 0.3 && !inColumn(x, row.y, 6) && hash2(65, row.i, n) < 0.35)      // side water: swells take over
      if (skip) { x += len + gap; n++; continue }
      for (var k = 0; k < len; k++) {
        var xx = x + k
        if (xx < 0 || xx >= W) continue
        // a gentle sag in long segments: the wave crest curves
        var sag = t > 0.5 && len > 10 ? Math.round(Math.sin(Math.PI * k / len) * (t > 0.8 ? 1.5 : 1)) : 0
        var y = row.y - sag + dy, base = waterKey(xx, y)
        var lit = UP[base]
        if (t > 0.65) lit = UP[lit]
        c.px(xx, y, lit)
        if (t > 0.85 && k > 0 && k < len - 1) c.px(xx, y - 1, UP[base])          // near: thick crest
        if (t > 0.45) c.px(xx, y + 1, DOWN[waterKey(xx, y + 1)])
        if (t > 0.75 && k > 1 && k < len - 2) c.px(xx, y + 2, DOWN[waterKey(xx, y + 2)])
      }
      x += len + gap; n++
    }
  })

  SWELLS.forEach(function (sw) {
    var dy = bob(m, sw.row)
    for (var k = 0; k < sw.len; k++) {
      var x = sw.x0 + k
      if (x < 0 || x >= W || inColumn(x, sw.y, 4)) continue
      if (hash2(67, sw.row, (x >> 4)) < 0.15) continue // an occasional break
      var y = sw.y - Math.round(2 * Math.sin(Math.PI * k / sw.len)) + dy, base = waterKey(x, y)
      c.px(x, y, sw.t > 0.6 ? UP[UP[base]] : UP[base])
      if (sw.t > 0.4) c.px(x, y + 1, DOWN[waterKey(x, y + 1)])
    }
  })
}

/**
 * The light's reflection: broken horizontal dashes on every wave row inside the column, brightest
 * in the middle (white-hot → bright → mid → sky-light at the edges), with dashes thinning out
 * towards the column's edges. The focal point. In loops each row shimmers: its dashes slide 1–2 px
 * and flick one ramp step, each row at its own phase.
 */
var GLINT = ["w", "o", "n", "k"]
function reflection(c, m) {
  var lines = []
  ROWS.forEach(function (row, i) {
    lines.push({ y: row.y, t: row.t, i: i * 2, row: i })
    var next = ROWS[i + 1]
    if (next && next.y - row.y >= 6) lines.push({ y: Math.round((row.y + next.y) / 2), t: row.t, i: i * 2 + 1, row: i })
  })
  lines.forEach(function (row) {
    var hw = columnHalf(row.y), n = 0
    var ph = 2 * Math.PI * (m.p + hash2(74, row.i, 0))
    var slide = m.on ? Math.round(1.5 * Math.sin(ph)) : 0
    var flick = m.on && Math.sin(2 * ph) > 0.5 ? 1 : 0
    var y = row.y + bob(m, row.row)
    for (var x = Math.floor(LIGHT_X - hw); x <= LIGHT_X + hw; ) {
      var len = Math.max(2, Math.round((2 + row.t * 9) * (0.5 + hash2(71, row.i, n))))
      var r = Math.abs(x + len / 2 - LIGHT_X) / hw
      if (hash2(72, row.i, n) > 1 - r * 0.8) { x += len + 1; n++; continue } // thinner at the edges
      var gi = Math.min(3, (r < 0.25 ? 0 : r < 0.5 ? 1 : r < 0.78 ? 2 : 3) + (hash2(75, row.i, n) > 0.5 ? flick : 0))
      c.rect(x + slide, y, len, 1, GLINT[gi])
      if (row.t > 0.4 && r < 0.6) c.rect(x + slide, y + 1, len, 1, GLINT[Math.min(3, gi + 1)]) // thicker nearer
      x += len + 1 + Math.round(hash2(73, row.i, n) * 2 * (1 + row.t)); n++
    }
  })
}

/** Foam line positions (with the loop's advance / pull-back). */
function foamY(x, fi, m) {
  return Math.round(SHORE + fi * 10 + 3 * Math.sin(x / 21 + fi) + 1.5 * Math.sin(x / 7.3 + fi * 2)) + foamShift(m)
}

/** Foam: two broken, scalloped lines where the waves end: a lit top (m) over a softer body (l). */
function foam(c, m) {
  [[2, 0], [1, 1]].forEach(function (f, fi) {
    for (var x = 0; x < W; x++) {
      if (hash2(81, fi, x >> 3) < (fi ? 0.4 : 0.15)) continue // broken
      var y = foamY(x, fi, m)
      c.px(x, y, "m")
      for (var k = 1; k < f[0]; k++) c.px(x, y + k, "l")
    }
  })
}

/**
 * Beach: wet sand from the foam down to the wet line, mirroring the sky darker (stepped bands of
 * plum and rose over sand shadow, with a faint continuation of the light's column), then dry sand:
 * one hard step from sand shadow to the darkest, warmest sand at the bottom, and sparse curved
 * wind ripples.
 */
function beach(c, m) {
  for (var y = SHORE; y < H; y++)
    for (var x = 0; x < W; x++) {
      var edge = foamY(x, 1, m)
      if (y <= edge) continue
      var k, wl = wetLine(x)
      if (y < wl) {
        var v = (y - edge) / (wl - edge)
        k = v < 0.35 ? "D" : v < 0.7 ? "d" : "S"
        // the light's column carries on faintly in the wet sand: horizontal dashes
        if (Math.abs(x - LIGHT_X) < columnHalf(y) * 0.45 && y % 3 === 0 && hash2(84, x >> 3, y) > 0.3) k = v < 0.5 ? "u" : "d"
      } else {
        k = y < 540 + Math.round(2 * Math.sin(x / 37)) ? "S" : "A" // one hard step, no dither seam
        // wind ripples: curved arcs (not straight dashes, so they don't read as water); in the
        // bottom safe zone a few more of them, still sparse
        var d = y - WET, sp = 15 + Math.round(d / 10)
        var bend = Math.round(5 * Math.sin(x / 41 + d / 60) + 2 * Math.sin(x / 13))
        var r = ((d + bend) % sp + sp) % sp
        var on = d > 10 && fbm1(85 + Math.floor((d + bend) / sp), x / 30) > (y > 560 ? 0.48 : 0.55)
        if (r === 0 && on) k = k === "A" ? "S" : "s"
        if (r === 1 && on) k = k === "A" ? "B" : "A"
      }
      c.px(x, y, k)
    }
}

/**
 * Rock outcrop on the left of the shore, standing in the wet sand: three irregular boulders,
 * back to front, split into facets (lit top plane and sun-side face b with t on lit edges, mid
 * front r, far face R, dark wet foot B), a deepShadow outline on the side away from the light, a
 * wet dark band where they meet the sand, a short broken darker reflection in the wet sand below
 * them, and foam around the base.
 */
var ROCKS = [
  { pts: [10, 486, 6, 462, 18, 446, 40, 442, 52, 456, 50, 486], ridge: 30 },
  { pts: [36, 492, 34, 470, 48, 452, 70, 448, 86, 460, 90, 492], ridge: 66 },
  { pts: [78, 494, 80, 480, 92, 472, 106, 474, 112, 494], ridge: 98 },
]
var ROCK_REFL = { t: "R", b: "R", r: "B", R: "B", B: "B" }
function rocks(c) {
  ROCKS.forEach(function (rk) {
    c.poly(rk.pts, "R")
    var ys = rk.pts.filter(function (_, i) { return i % 2 }), xs = rk.pts.filter(function (_, i) { return !(i % 2) })
    var top = Math.min.apply(null, ys), bot = Math.max.apply(null, ys)
    for (var y = top; y < bot; y++)
      for (var x = Math.min.apply(null, xs); x < Math.max.apply(null, xs); x++) {
        if (!c.is(x, y, "R")) continue
        var v = (y - top) / (bot - top), k = "R"
        if (x > rk.ridge - (1 - v) * 6) k = "b"              // face towards the light (right)
        else if (x > rk.ridge - 10) k = "r"                   // front, turning
        if (v < 0.22 && x > rk.ridge - 14) k = "b"           // top plane catches the low light
        if (v > 0.86) k = "B"                                 // wet, shadowed foot
        c.px(x, y, k)
      }
    for (var y = top; y < bot; y++)
      for (var x = Math.min.apply(null, xs); x < Math.max.apply(null, xs); x++) {
        if (!c.is(x, y, "RrbB")) continue
        if (c.is(x, y, "b") && (!c.is(x + 1, y, "RrbtB") || !c.is(x, y - 1, "RrbtB"))) c.px(x, y, "t")
        else if (c.is(x, y, "R") && !c.is(x - 1, y, "RrbtB")) c.px(x, y, "B")
      }
  })
  // Per column: the rocks' lowest pixel (their foot on the sand).
  var foot = []
  for (var x = 0; x < 120; x++) { foot[x] = -1; for (var y = 440; y < 500; y++) if (c.is(x, y, "tbrRB")) foot[x] = y }
  // Reflection: mirror the lowest 14 rows below the foot, darker, broken every other row.
  for (var x = 0; x < 120; x++) {
    if (foot[x] < 0) continue
    for (var d = 0; d < 14; d++) {
      var src = foot[x] - d, dst = foot[x] + 3 + Math.round(d * 0.7)
      if (!c.is(x, src, "tbrRB") || dst >= wetLine(x) || dst % 2) continue
      if (hash2(86, x >> 2, dst) < 0.25) continue
      c.px(x, dst, ROCK_REFL[c.key(x, src)])
    }
  }
  // Wet dark band where the rocks meet the sand.
  for (var x = 0; x < 120; x++) {
    var f = foot[x] >= 0 ? foot[x] : Math.max(foot[x - 1] || -1, foot[x + 1] || -1, foot[x - 2] || -1, foot[x + 2] || -1)
    if (f < 0) continue
    c.px(x, f + 1, "B"); c.px(x, f + 2, "A")
  }
  // Foam around the base: short broken runs lying on the wet band just outside the rocks' foot.
  for (var x = 0; x < 120; x++) {
    var f = foot[x] >= 0 ? foot[x] : Math.max(foot[x - 1] || -1, foot[x + 1] || -1, foot[x - 2] || -1, foot[x + 2] || -1)
    if (f < 0 || hash2(83, x >> 2, 0) < 0.55) continue
    c.px(x, f + 1, (x >> 2) % 2 ? "m" : "l")
  }
}

/** Everything below the sky, at rest (STILL) or for one loop frame (motion(c)). */
function seaItems(animate) {
  function st(c) { return animate ? motion(c) : STILL }
  return [
    function (c) { sea(c, st(c)) },
    function (c) { reflection(c, st(c)) },
    function (c) { beach(c, st(c)) },
    function (c) { foam(c, st(c)) },
    rocks,
  ]
}

function seaScene(time) {
  palette(time)
  scene("sea_" + time, { w: W, h: H, bg: "U" },
    ...skyLayer(time, SKY_OPTS[time]),
    ...seaItems(false),
  )
}

seaScene("dusk")
seaScene("night")
