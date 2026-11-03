// beach_night — a windy beach at night under a bright full moon: torn clouds stream past the moon,
// two waves break and wash up the sand, a palm and the dune grass bend in the wind.
//
// Light: the full moon upper right (MOON). Cloud edges, palm fronds and grass blades are lit on the
// side facing it; its silver path runs down the water to the shore (the focal point, right third)
// and carries on faintly in the wet sand. The wave faces turn away from it (backlit, dark) with
// bright crests; the near dune faces the viewer, away from the moon, so it stays dark.
// Palette: "beach_night" = night + z recoloured a pale moonlit green (frond edges facing the moon).
// Wind: from the right, blowing LEFT. Clouds, fronds, grass and blown sand all lean that way.
//
// Depth, back to front: sky → open sea (wave rows growing toward the beach) → two breakers →
// foam wash → wet sand → dry sand → dune lip with grass and the palm → dune face (bottom safe zone).
include("../palettes.px.js")
include("../lib/noise.px.js")
include("../lib/dither.px.js")
include("../lib/sky.px.js")

var W = 360, H = 640
var HORIZON = 270
var SKY = {
  horizon: HORIZON,
  moon: { x: 262, y: 150 },
  clouds: { x: -400, stratus: { hide: [0] } }, // our own streaming clouds instead
  stars: { maxY: 200 },
  glow: { r: 18, ramp: 2 },
}
var MOON = skyLight("night", SKY)
var LIGHT_X = MOON.x // the moon path's axis
var WIND = -1        // blowing left

// Motion state for loops. Stills use STILL; anims build one per frame from c.phase (every offset
// is periodic in the loop phase, so the last frame flows into the first).
var STILL = { on: false, p: 0 }
function motion(c) { return { on: true, p: c.phase || 0 } }
var TAU = 2 * Math.PI

// Gust strength 0..1 at loop phase p for something at its own phase offset: two gusts per cycle,
// a quick bend and a slower ease back.
function gust(m, off) {
  if (!m.on) return 0.35
  var s = Math.sin(TAU * (2 * m.p + off))
  return 0.5 + 0.5 * s * (s > 0 ? 1 : 0.6)
}

// ---------------------------------------------------------------- clouds

/**
 * Thin, torn streaks stretched by the wind. Each streak lives for one loop: it streams left by
 * DRIFT px, tearing in as it forms and tearing apart as it fades (so the loop wraps seamlessly).
 * Edges facing the moon are lit; near the moon the outermost edge gets the highlight.
 * [x, y, len, thickness, seed, life phase]
 */
var DRIFT = 48
var STREAKS = [
  [0, 100, 190, 9, 1, 0.45], [236, 108, 150, 7, 2, 0.8], [118, 124, 110, 5, 3, 0.25],
  [196, 182, 120, 6, 11, 0.5], [12, 160, 170, 7, 6, 0.15], [312, 150, 90, 5, 4, 0.6],
  [130, 206, 120, 9, 7, 0.7], [250, 214, 150, 8, 5, 0.3], [276, 240, 110, 5, 8, 0.85],
  [-20, 236, 200, 6, 9, 0.9], [150, 258, 200, 5, 10, 0.05],
]
function clouds(c, m) {
  var mask = new Int8Array(W * H).fill(-1) // role: 0 bottom rim, 1 underside, 2 body
  STREAKS.forEach(function (s) {
    var q = ((m.p + s[5]) % 1 + 1) % 1, life = Math.sin(Math.PI * q)
    var x0 = Math.round(s[0] - DRIFT * (q - 0.5)), seed = 200 + s[4]
    // a streak is a chain of wisps: lens shapes with the head upwind (right) and a long tail
    // downwind (left), overlapping; as the streak forms and fades its wisps thin out and tear apart
    var n = Math.max(2, Math.round(s[2] / 30))
    for (var j = 0; j < n; j++) {
      var keep = hash2(seed, j, 0)
      if (keep > 0.25 + 0.95 * life) continue
      var lw = Math.round(s[2] / n * (1.4 + 1.2 * hash2(seed, j, 1)))
      var wx = x0 + Math.round(j * s[2] / n + (hash2(seed, j, 2) - 0.5) * 34)
      var wy = s[1] + Math.round((hash2(seed, j, 3) - 0.5) * s[3] * 2.2)
      var tw = s[3] * (0.35 + 0.75 * hash2(seed, j, 4)) * (0.45 + 0.55 * life)
      // ragged tail: 1–2 thin strands trailing downwind (left), torn into pieces, drifting up or down
      var tl = Math.round(lw * (0.2 + 0.7 * hash2(seed, j, 5))), strands = hash2(seed, j, 6) > 0.45 ? 1 : 0
      for (var st = 0; st < strands; st++) {
        var slope = (hash2(seed, j, 7 + st) - 0.5) * 0.12, dyS = st * 3
        for (var i = -tl; i < lw * 0.25; i++) {
          var x = wx + i
          if (x < 0 || x >= W || fbm1(seed + 80 + j * 3 + st, i / 6, { octaves: 2 }) < 0.42 + 0.3 * (-i / tl)) continue
          var y = wy - dyS + Math.round(slope * i)
          if (y < 1 || y >= HORIZON || Math.hypot(x - MOON.x, y - MOON.y) < MOON.r + 3) continue
          mask[y * W + x] = Math.max(mask[y * W + x], 1); mask[(y - 1) * W + x] = Math.max(mask[(y - 1) * W + x], 2)
        }
      }
      for (var i = 0; i < lw; i++) {
        var v = i / lw, prof = Math.pow(Math.sin(Math.PI * Math.pow(v, 1.7)), 0.9)
        var th = Math.round(tw * prof * (0.75 + 0.5 * fbm1(seed + j * 7, i / 9, { octaves: 2 })))
        if (th < 2) continue
        var x = wx + i
        if (x < 0 || x >= W) continue
        // the lower edge is flatter than the top (wind-shear), the top ripples
        var bot = wy + Math.round(1.5 * Math.sin(i / 23 + j)), top = bot - th + 1
        for (var y = top; y <= bot; y++) {
          if (y < 0 || y >= HORIZON || Math.hypot(x - MOON.x, y - MOON.y) < MOON.r + 3) continue // never over the disk
          var r = bot - y
          mask[y * W + x] = Math.max(mask[y * W + x], r === 0 ? 0 : r < 3 && th >= 5 ? 1 : 2)
        }
      }
    }
  })
  function inC(x, y) { return x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x] >= 0 }
  for (var y = 0; y < HORIZON; y++)
    for (var x = 0; x < W; x++) {
      var role = mask[y * W + x]
      if (role < 0) continue
      var L = skyToLight(MOON, x, y), k = "LCc"[role]
      if (!inC(x + Math.round(L[0] * 2), y + Math.round(L[1] * 2))) {
        k = "l" // edge facing the moon
        if (!inC(x + Math.round(L[0]), y + Math.round(L[1])) && Math.hypot(x - MOON.x, y - MOON.y) < 90) k = "m"
      }
      c.px(x, y, k)
    }
}

// ---------------------------------------------------------------- sea

/**
 * The two break spots. Each spot breaks one wave per loop: a wave's age a runs 0..2 —
 * 0..1 it rises out of the swell and comes in, peeling from `from` (whitewater on the `broken`
 * side, PEEL px per unit of age from a = 0.45); 1..2 it has fully broken, the whitewater settles
 * and rolls forward, and at the near spot its foam drives the wash up the sand and back. Two ages
 * one apart are drawn per spot, so the loop wraps seamlessly. a0 = the age shown at phase 0 (the
 * still): far whitewater peeled in to x≈310 from the right, near to x≈120 from the left.
 */
var BREAK = [
  { y: 380, h: 10, broken: 1, from: 390, seed: 1, a0: 0.62 },  // far breaker
  { y: 414, h: 17, broken: -1, from: -30, seed: 2, a0: 0.77 }, // near breaker
]
var PEEL = 470
function waveAt(b, a) {
  if (a <= 0 || a >= 2) return null
  var rise = a < 1 ? Math.min(1, a / 0.5) : Math.max(0, 1 - (a - 1) / 0.55)
  rise = rise * rise * (3 - 2 * rise) // smoothstep
  if (rise < 0.08) return null
  return {
    y: b.y, h: b.h, broken: b.broken, seed: b.seed, rise: rise,
    adv: a < 1 ? -Math.round(10 * (1 - a)) : Math.round(14 * (a - 1)),
    at: b.from - b.broken * PEEL * Math.max(0, a - 0.45),
  }
}
/** Both spots: the younger wave first, the older (nearer, collapsing) one over it. */
function waves(c, m) {
  BREAK.forEach(function (b) {
    var a = ((m.p + b.a0) % 1 + 1) % 1
    ;[a, a + 1].forEach(function (age) {
      var w = waveAt(b, age)
      if (w) breaker(c, w, m, w.rise, w.adv)
    })
  })
}
/** The wash's reach: rests at WASH, runs up quickly after the near wave collapses, drains slowly. */
function washReach(m) {
  var u = ((m.p + BREAK[1].a0) % 1 + 1) % 1
  var bump = u < 0.45 ? Math.pow(Math.sin(Math.PI / 2 * u / 0.45), 2) : Math.pow(Math.cos(Math.PI / 2 * (u - 0.45) / 0.55), 2)
  return WASH + Math.round(18 * bump)
}
var SEA_END = BREAK[0].y - 12

var UP = { U: "D", D: "d", d: "u", u: "k", k: "k" }, DOWN = { k: "u", u: "d", d: "D", D: "U", U: "U" }

/** Water reflects the sky: pale near the horizon, darker nearer. */
function waterKey(x, y) {
  var v = Math.min(1, (y - HORIZON) / (SEA_END - HORIZON))
  return rampKey(x, y, 0.95 - v * 0.75, "UDdu", 0.4)
}
function columnHalf(y) { return 4 + (y - HORIZON) * 0.3 }
function inColumn(x, y, pad) { return Math.abs(x - LIGHT_X) < columnHalf(y) + (pad || 0) }

var ROWS = (function () {
  var rows = [], N = 15
  for (var i = 0; i < N; i++) {
    var t = i / (N - 1)
    rows.push({ y: Math.round(HORIZON + 3 + Math.pow(t, 1.6) * (SEA_END - HORIZON - 6)), t: t, i: i })
  }
  return rows
})()
// Wave rows roll in: row i bobs at its own phase, spread over the cycle.
function bob(m, i) { return m.on && Math.sin(TAU * (2 * m.p - i / ROWS.length)) > 0 ? 1 : 0 }

/** Open sea: sky-reflecting water and perspective wave rows, bigger and choppier toward the beach. */
function sea(c, m) {
  for (var y = HORIZON; y < BREAK[1].y + 4; y++)
    for (var x = 0; x < W; x++) c.px(x, y, waterKey(x, y))
  c.hline(0, HORIZON, W, "u") // a crisp horizon line
  ROWS.forEach(function (row) {
    var t = row.t, x = Math.floor(hash2(61, row.i, 0) * 20) - 20, n = 0, dy = bob(m, row.i)
    while (x < W) {
      var len = Math.round(3 + 18 * Math.pow(t, 1.1) * (0.5 + hash2(61, row.i, n)))
      var gap = Math.round(2 + 18 * t * (0.4 + hash2(62, row.i, n)))
      if (t < 0.3 && hash2(64, row.i, n) < 0.3) { x += len + gap; n++; continue }
      for (var k = 0; k < len; k++) {
        var xx = x + k
        if (xx < 0 || xx >= W) continue
        var sag = t > 0.6 && len > 12 ? Math.round(Math.sin(Math.PI * k / len)) : 0
        var y = row.y - sag + dy, base = waterKey(xx, y), lit = UP[base]
        if (t > 0.6) lit = UP[lit]
        c.px(xx, y, lit)
        if (t > 0.8 && k > 0 && k < len - 1) c.px(xx, y - 1, UP[base])
        if (t > 0.4) c.px(xx, y + 1, DOWN[waterKey(xx, y + 1)])
        if (t > 0.7 && k > 1 && k < len - 2) c.px(xx, y + 2, "U")
        // windblown spray off the bigger crests, a short tail downwind
        if (t > 0.7 && k === 0 && hash2(68, row.i, n) > 0.6) c.rect(xx + WIND * 3, y - 1, 2, 1, "u")
      }
      x += len + gap; n++
    }
  })
}

/**
 * The moon path: broken horizontal dashes on every wave row inside the column, white-hot in the
 * middle, thinning and dimming toward the edges. Shimmers in loops (slide 1–2 px, flick a step).
 */
var GLINT = ["w", "o", "n", "k"]
function moonPath(c, m) {
  var lines = []
  ROWS.forEach(function (row, i) {
    lines.push({ y: row.y, t: row.t, i: i * 2, row: i })
    var next = ROWS[i + 1]
    if (next && next.y - row.y >= 5) lines.push({ y: Math.round((row.y + next.y) / 2), t: row.t, i: i * 2 + 1, row: i })
  })
  for (var y = BREAK[0].y + 8; y < BREAK[1].y - BREAK[1].h - 2; y += 4) lines.push({ y: y, t: 1, i: 40 + y, row: ROWS.length - 1, dim: 1 })
  lines.forEach(function (row) {
    var hw = columnHalf(row.y), n = 0
    var ph = TAU * (m.p * 4 + row.i / lines.length)
    var slide = m.on ? Math.round(1.5 * Math.sin(ph)) : 0
    var flick = m.on && Math.sin(2 * ph) > 0.5 ? 1 : 0
    var y = row.dim ? row.y : row.y + bob(m, row.row)
    for (var x = Math.floor(LIGHT_X - hw); x <= LIGHT_X + hw; ) {
      var len = Math.max(2, Math.round((2 + row.t * 9) * (0.5 + hash2(71, row.i, n))))
      var r = Math.abs(x + len / 2 - LIGHT_X) / hw
      if (hash2(72, row.i, n) > 1 - r * 0.8) { x += len + 1; n++; continue }
      var gi = Math.min(3, (r < 0.25 ? 0 : r < 0.5 ? 1 : r < 0.78 ? 2 : 3) + (hash2(75, row.i, n) > 0.5 ? flick : 0) + (row.dim || 0))
      c.rect(x + slide, y, len, 1, GLINT[gi])
      if (row.t > 0.4 && r < 0.6) c.rect(x + slide, y + 1, len, 1, GLINT[Math.min(3, gi + 1)])
      x += len + 1 + Math.round(hash2(73, row.i, n) * 2 * (1 + row.t)); n++
    }
  })
}

// ---------------------------------------------------------------- breaking waves

/** Rounded foam bumps along the whitewater's top: height above the mound line at x. */
function bumpsAt(x, seed) {
  var best = 0
  for (var j = Math.floor(x / 7) - 2; j <= Math.floor(x / 7) + 2; j++) {
    var cx = j * 7 + hash2(seed, j, 0) * 4, r = 3 + hash2(seed, j, 1) * 4, dx = x + 0.5 - cx
    if (Math.abs(dx) < r) best = Math.max(best, Math.sqrt(r * r - dx * dx) * 0.8)
  }
  return Math.round(best)
}

/**
 * A breaking wave across the bay, tallest at its peel point. Clean side: a dark, backlit face
 * (steps from the crest down) under a bright crest line, hot where the moon path crosses it.
 * At the peel point the lip pitches forward: a bright falling curtain over the dark hollow, spray
 * above. Broken side: whitewater with a bumpy top (lit on the moon's side of each bump), a grey,
 * bubbly body darkening toward the base, spray blown off downwind, and a soup band of lace
 * spreading forward. `adv` (loops) moves the wave toward the beach, `rise` scales its height.
 */
function breaker(c, b, m, rise, adv) {
  var curlW = Math.round(b.h * 1.4)
  for (var x = 0; x < W; x++) {
    var side = (x - b.at) * b.broken // > 0: broken, < -curlW: clean, between: curl
    var hh = Math.round(b.h * rise * (0.5 + 0.5 * Math.exp(-Math.abs(side) / 80)) * (0.9 + 0.2 * fbm1(b.seed + 30, x / 40)))
    var base = b.y + adv, top = base - hh
    if (side < -curlW) { // clean face
      for (var y = top; y <= base; y++) {
        var v = (y - top) / Math.max(1, hh), k = v < 0.3 ? "d" : v < 0.65 ? "D" : "U"
        c.px(x, y, k)
      }
      var hot = inColumn(x, top, 0) ? (Math.abs(x - LIGHT_X) < columnHalf(top) * 0.4 ? "w" : "o") : "k"
      c.px(x, top, hot); c.px(x, top - 1, inColumn(x, top, 0) ? "n" : "u")
    } else if (side <= 0) { // curl
      var f = 1 + side / curlW // 0 at the clean end .. 1 at the broken end
      var lipTop = top - Math.round(2 * Math.sin(Math.PI * f)) // the lip pitches up and over
      var lip = lipTop + Math.round(hh * 0.95 * Math.pow(f, 1.4))
      for (var y = lipTop; y <= base; y++) c.px(x, y, y < lip - 1 ? (y - lipTop < 2 ? "u" : "U") : y > lip ? "D" : "w")
      c.px(x, lipTop, "o"); c.px(x, lip - 1, "o")
      if (f > 0.4 && hash2(90 + b.seed, x, 0) > 0.35) c.px(x + WIND, lipTop - 1 - Math.round(f * 3 * hash2(93 + b.seed, x, 0)), "m") // spray
    } else { // whitewater
      var settle = Math.min(1, side / 110), mound = Math.round(hh * (1.1 - 0.4 * settle))
      var wtop = base - mound - Math.round(bumpsAt(x, b.seed + 40) * Math.min(1, rise * 1.5)), depth = base + 1 - wtop
      for (var y = wtop; y <= base + 1; y++) {
        var d = y - wtop, f = d / depth, k
        var edgeR = bumpsAt(x + 1, b.seed + 40) < bumpsAt(x, b.seed + 40) // right side of a bump: faces the moon
        if (d === 0) k = edgeR ? "w" : "o"
        else if (d < 3) k = edgeR || d === 1 ? "o" : "m"
        else {
          var bub = hash2(94 + b.seed, x >> 1, y >> 1)
          k = f < 0.55 ? (bub > 0.7 ? "o" : "m") : f < 0.85 ? (bub > 0.75 ? "m" : "l") : "c"
          if (fbm2(b.seed + 5, x / 3, y / 8) < 0.28 && f > 0.4) k = "c" // foam tumbling down the face
        }
        c.px(x, y, k)
      }
      // spray blown off the top, downwind
      if (hash2(91 + b.seed, x, 0) > 0.8) c.rect(x + WIND * 2, wtop - 2, 2, 1, "m")
      if (hash2(92 + b.seed, x, 0) > 0.9) c.px(x + WIND * 5, wtop - 3 - (x & 1), "l")
    }
    // soup: foam lace spreading forward from the base (wider under the whitewater)
    var soup = side > 0 ? 3 + Math.round(5 * fbm1(b.seed + 60, x / 18)) : side > -curlW * 3 ? 2 : 0
    for (var d = 1; d <= soup; d++) {
      var y = base + 1 + d
      if (fbm2(b.seed + 70, x / 4, y / 2) > 0.36 + d * 0.06) c.px(x, y, d === 1 ? "m" : "l")
    }
  }
}

/** Foam lace drifting on the water between the breakers: thin curved threads. */
function lace(c, m, y0, y1, seed, shift) {
  for (var y = y0; y < y1; y++)
    for (var x = 0; x < W; x++) {
      var n = fbm2(seed, (x + shift) / 16, y / 3, { octaves: 3 })
      if (Math.abs(n - 0.5) < 0.025) c.px(x, y, (x + y) % 5 ? "c" : "l")
    }
}

// ---------------------------------------------------------------- the wash and the beach

var WASH = 438     // where the wash's scalloped leading edge reaches (at rest)
var WET = 462      // wet sand gives way to dry
function duneTop(x) {
  return Math.round(476 + 4 * Math.sin(x / 47 + 1) + 2 * Math.sin(x / 13) - 14 * Math.exp(-Math.pow((x - 40) / 60, 2)))
}

/** Leading edge of the wash: scallops (arcs bulging toward the viewer). */
function washEdge(x, reach) {
  var P = 46, xx = x + 9 * Math.sin(x / 50), u = ((xx % P) + P) % P / P, j = Math.floor(xx / P)
  var depth = 3 + 3 * hash2(89, j, 0) // each scallop reaches its own distance
  return Math.round(reach + depth * Math.pow(Math.max(0, 1 - Math.pow(2 * u - 1, 2)), 0.5) + 2 * Math.sin(x / 33))
}

/**
 * The foam wash sliding up the wet sand: a thin sheet reflecting the sky (D/d) with lace, a
 * scalloped foam edge, then wet sand mirroring the sky and the moon faintly (a broken column of
 * pale dashes under the moon), then dry, moonlit sand.
 */
function beach(c, m, reach) {
  for (var y = BREAK[1].y + 2; y < 500; y++)
    for (var x = 0; x < W; x++) {
      var edge = washEdge(x, reach), k
      if (y < edge - 2) {
        var v = (y - BREAK[1].y) / (edge - BREAK[1].y)
        k = v < 0.5 ? "D" : "d"
        if (Math.abs(x - LIGHT_X) < columnHalf(y) * 0.4 && y % 3 === 0 && hash2(84, x >> 2, y) > 0.45) k = v < 0.5 ? "d" : "u"
      } else if (y <= edge) {
        if (y === edge - 2) { c.px(x, y, "l"); continue }
        k = y === edge ? "m" : "o" // the scalloped foam edge
      } else if (y < WET + Math.round(2 * Math.sin(x / 29))) {
        var w = (y - edge) / (WET - edge)
        k = w < 0.45 ? "D" : "S" // wet sand mirrors the sky darker, then the sand shows through
        if (Math.abs(x - LIGHT_X) < columnHalf(y) * 0.35 && y % 3 === 1 && hash2(85, x >> 2, y) > 0.3) k = w < 0.45 ? "d" : "s"
      } else {
        k = "s" // dry sand, facing up into the moonlight
        if (y > WET + 4 && (y + Math.round(3 * Math.sin(x / 41))) % 6 === 0 && fbm1(86 + y, x / 40) > 0.6) k = "a" // ripple crests
      }
      c.px(x, y, k)
    }
  // lace on the sheet, following the scallops
  for (var x = 0; x < W; x++) {
    var e = washEdge(x, reach)
    for (var d = 4; d < 14; d += 4) if (fbm1(87 + d, x / 9) > 0.55) c.px(x, e - d - Math.round(fbm1(88 + d, x / 7) * 2), "c")
  }
}

/**
 * The dune lip and its face: a dark crest line rising under the palm, moonlit along its top, the
 * face toward the viewer in shadow. The face down into the bottom safe zone is texture only:
 * slanted wind ripples (crests 1 step lighter), sparse.
 */
function dune(c) {
  for (var x = 0; x < W; x++) {
    var top = duneTop(x)
    for (var y = top; y < H; y++) {
      var d = y - top, k = d < 1 ? "g" : d < 3 ? "a" : d < 9 + Math.round(2 * Math.sin(x / 17 + 2)) ? "s" : "S"
      if (d >= 12) {
        // wind ripples on the face: long slanted arcs, crests one step lighter, shadow under them
        var sp = 11 + Math.round(d / 14), q = ((y + Math.round(x * 0.18 + 4 * Math.sin(x / 31 + y / 70))) % sp + sp) % sp
        var on = fbm1(300 + Math.floor((y + x * 0.18) / sp), x / 26) > 0.42
        if (on && q === 0) k = "s"
        if (on && q === 1) k = "A"
      }
      c.px(x, y, k)
    }
  }
}

// ---------------------------------------------------------------- grass and blown sand

var CLUMPS = [[80, 22], [126, 14], [176, 10], [222, 18], [262, 9], [304, 22], [346, 14], [12, 12]]

/**
 * Dune grass: clumps of blades rising from the lip and bending downwind (left), longer ones
 * further. Blades are 2 px at the base, 1 px at the tip; lit on the moon side (right).
 */
var NEAR_CLUMPS = [[150, 26, 512], [338, 20, 506], [240, 12, 518]]
function grass(c, m) {
  CLUMPS.concat(NEAR_CLUMPS).forEach(function (cl, ci) {
    var bx = cl[0], n = cl[1], near = cl.length > 2
    for (var i = 0; i < n; i++) {
      var x0 = bx + Math.round((hash2(110, ci, i) - 0.5) * n * 1.4), y0 = near ? cl[2] + Math.round(hash2(113, ci, i) * 4) : duneTop(x0) + 2
      var hgt = (near ? 30 : 16) + hash2(111, ci, i) * (near ? 34 : 26), g = gust(m, ci * 0.09 + i * 0.013)
      var bend = (0.5 + 0.9 * hash2(112, ci, i)) * (0.6 + 0.8 * g) * hgt * 0.9
      var steps = Math.round(hgt * 1.4), px0 = null
      for (var s = 0; s <= steps; s++) {
        var t = s / steps
        var x = Math.round(x0 + WIND * bend * t * t), y = Math.round(y0 - hgt * t * (1 - 0.35 * t * t * (bend / hgt)))
        c.px(x, y, "J")
        if (near && t < 0.6) c.px(x - 1, y, "J") // near blades are wider
        if (t < 0.7) c.px(x + 1, y, "j")    // lit side (moon on the right); the blade thins to 1 px
      }
    }
  })
}

/** Sand grains blown off the dune lip downwind: short dashes trailing left of a few crest points. */
var GRAINS = [[110, 0.1], [160, 0.5], [214, 0.3], [250, 0.8], [292, 0.6], [334, 0.2], [70, 0.9]]
function blownSand(c, m) {
  GRAINS.forEach(function (gr, gi) {
    for (var j = 0; j < 4; j++) {
      // each grain flies left and slightly up, then drops; a fresh one leaves every quarter cycle
      var q = ((m.p * 2 + gr[1] + j / 4) % 1 + 1) % 1
      var x = Math.round(gr[0] + WIND * q * 44), y = Math.round(duneTop(gr[0]) - 2 - 7 * Math.sin(Math.PI * q) - j % 2)
      c.rect(x, y, 2, 1, q < 0.6 ? "g" : "a")
      c.px(x - WIND * 2, y, "s") // a short trail upwind
    }
  })
}

// ---------------------------------------------------------------- palm

var PALM_BASE = [36, 470], PALM_TOP = [104, 212]
/** Trunk spine: a cubic curve leaning right, bowing as it rises. */
function trunkAt(t) {
  var P = [[36, 470], [28, 370], [64, 262], [104, 212]], u = 1 - t
  return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0],
          u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]]
}

// Fronds: start angle (degrees, 0 = right, -90 = up), length, gust phase.
var FRONDS = [[-160, 104, 0.0], [-128, 112, 0.05], [-95, 96, 0.1], [-62, 100, 0.15], [-28, 90, 0.2],
              [8, 80, 0.25], [150, 92, 0.3], [118, 78, 0.35], [-185, 88, 0.4], [62, 64, 0.45]]

/**
 * The palm: a curving, leaning trunk (ringed, lit on the moon side) and fronds swept downwind.
 * Each frond's rib starts at its own angle and turns toward the wind (left and a little down)
 * along its length, further in a gust; leaflets hang off both sides, trailing with the rib.
 * Drawn into a mask first so the lit edge can follow the silhouette.
 */
function palm(c, m) {
  var mask = new Uint8Array(W * H) // 1 frond, 2 trunk, 3 trunk ring
  function put(x, y, v) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x] < v) mask[y * W + x] = v }
  // trunk
  for (var s = 0; s <= 400; s++) {
    var t = s / 400, p = trunkAt(t), wd = 6 - 2.5 * t
    var q = trunkAt(Math.min(1, t + 0.01)), dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1
    var nx = -dy / l, ny = dx / l
    var ring = (s % 13) < 2
    for (var w = -wd; w <= wd; w += 0.5) put(p[0] + nx * w, p[1] + ny * w, ring && Math.abs(w) < wd - 0.5 ? 3 : 2)
  }
  // crown: frond bases bunched at the top of the trunk
  for (var dy = -5; dy <= 4; dy++) for (var dx = -6; dx <= 6; dx++) if (dx * dx / 36 + dy * dy / 25 <= 1) put(PALM_TOP[0] + dx, PALM_TOP[1] + dy, 2)
  // fronds
  var WD = Math.PI * 1.06 // wind direction: left and slightly down
  FRONDS.forEach(function (f, fi) {
    var g = gust(m, f[2]), a0 = f[0] * Math.PI / 180, x = PALM_TOP[0], y = PALM_TOP[1], L = f[1]
    // take the short way round toward the wind direction
    var da = WD - a0
    while (da > Math.PI) da -= TAU
    while (da < -Math.PI) da += TAU
    for (var i = 0; i < L; i++) {
      var t = i / L, a = a0 + da * Math.min(1, Math.pow(t, 0.75) * (0.75 + 0.35 * g))
      x += Math.cos(a); y += Math.sin(a) + 0.15 * t // a little droop
      put(x, y, 1); put(x, y + 1, 1)
      if (i < 5) continue
      // leaflets both sides, trailing back along the rib (swept downwind) and hanging a little
      var len = Math.round((1 - t * 0.7) * 16 * (0.85 + 0.3 * hash2(120, fi, i)))
      ;[-1, 1].forEach(function (sd) {
        var la = a + sd * 0.45
        for (var k = 1; k <= len; k++) {
          var kk = k / len
          var lx = x + Math.cos(la) * k + WIND * kk * kk * 3 * (0.6 + g), ly = y + Math.sin(la) * k + kk * kk * (sd > 0 ? 5 : 2)
          put(lx, ly, 1); if (k < len * 0.6) put(lx, ly + 1, 1)
        }
      })
    }
  })
  function at(x, y) { return x >= 0 && x < W && y >= 0 && y < H ? mask[y * W + x] : 0 }
  for (var y = 0; y < H; y++)
    for (var x = 0; x < W; x++) {
      var v = mask[y * W + x]
      if (!v) continue
      // edge facing the moon (upper right); the trunk only looks at itself, so swaying fronds
      // never change its shading
      var A = v === 1 ? at : function (x, y) { return at(x, y) >= 2 }
      var lit = !A(x + 1, y) || !A(x + 1, y - 1) && !A(x, y - 1)
      var k
      // fronds: the top edge facing the moon in z (moonlit green, beach_night palette), the right edge in j
      if (v === 1) k = !at(x, y - 1) && !at(x + 1, y - 1) ? "z" : lit ? "j" : "J"
      else k = v === 3 ? "B" : lit ? "b" : !A(x - 1, y) ? "B" : "R"
      if (v === 2 && !lit && at(x + 1, y) === 2 && !A(x + 2, y)) k = "r" // a step before the lit edge
      c.px(x, y, k)
    }
}

// ---------------------------------------------------------------- scene

/** Everything below the sky and over it, at rest (STILL) or for one loop frame (motion(c)). */
function beachItems(animate) {
  function st(c) { return animate ? motion(c) : STILL }
  return [
    function (c) { clouds(c, st(c)) },
    function (c) { sea(c, st(c)) },
    function (c) { var m = st(c); lace(c, m, BREAK[0].y + 6, BREAK[1].y - BREAK[1].h - 2, 130, m.on ? Math.round(WIND * 16 * Math.sin(TAU * m.p)) : 0) },
    function (c) { moonPath(c, st(c)) },
    function (c) { var m = st(c); beach(c, m, washReach(m)) },
    function (c) { waves(c, st(c)) },
    dune,
    function (c) { grass(c, st(c)) },
    function (c) { blownSand(c, st(c)) },
    function (c) { palm(c, st(c)) },
  ]
}

palette("beach_night")
scene("beach_night", { w: W, h: H, bg: "U" },
  ...skyLayer("night", SKY),
  ...beachItems(false),
)
// Seamless loop: 48 frames at 12 fps (4 s). Main motion: each spot breaks one wave per cycle and
// the near one's foam washes up the sand and drains back. The moon path shimmers, clouds stream
// and tear, fronds and grass bend in gusts (each at its own phase), sand blows off the lip, a few
// stars twinkle. Moon, palm trunk and dune shapes stay still.
anim("beach_night_loop", { w: W, h: H, frames: 48, fps: 12 },
  ...skyLayer("night", Object.assign({}, SKY, { motion: { twinkle: { n: 8, maxY: 190 } } })),
  ...beachItems(true),
)
