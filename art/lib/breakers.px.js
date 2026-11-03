// Breaking waves seen from the beach, as scene items: breakers(opts) → [item], like skyLayer.
//   scene("x", { ... }, ...breakers({ spots: [...], light: MOON, column: fn }))
// Needs lib/noise.px.js. Top-level `function`/`var` only (see art/CLAUDE.md). Palette roles default
// to the night palette (sky ramp for water, moon ramp for the brightest foam, cloud ramp for foam).
//
// Each spot breaks one wave per loop. A wave's age a runs 0..2:
//   0..1  it rises out of the swell and comes in; from a = 0.45 it peels from `from` toward the
//         other side at `peel` px per unit of age (whitewater on the `broken` side, +1 = right);
//   1..2  it has broken: the foam billows shrink, sink and roll forward, and leave lace that thins.
// Two ages one apart are drawn per spot, so at phase 1 the picture is the one at phase 0 (seamless).
// a0 = the age shown at phase 0 (the still).
//
// Techniques borrowed from pixelfx's wave-crash (patch-gg/pixelfx, MIT; the lip after Hugo Duprez's
// slash, MIT): a thick lip, bright on its rim and tinted below, over a dark hollow; whitewater as
// round billows (shaded underside, body, lit cap) that grow and shrink; lace as a noise net that
// thins out; spray particles whose age comes from the loop time (pixelfx `cycle`). Hard-edged and
// palette-only here: no alpha, no additive light.
//
// opts:
//   spots   [{ y, h, broken, from, seed, a0 }]  base line, face height (px), whitewater side, peel start
//   peel    px of peel per unit of age (default 470)
//   wind    -1 blows left, +1 right (spray and billow drift go downwind)
//   light   { x, y }: foam caps face it
//   column  (x, y) → 0 | 1 | 2: outside / edge / core of a light's reflection (hot crest pixels)
//   animate true: read c.phase; false: phase 0 (the still)
//   keys    override palette roles (see BREAKER_KEYS)

var BREAKER_KEYS = {
  face: "dDU", crest: "k", crestBack: "u", crestDim: "u", hot: "wo", lip: "won", hollow: "U",
  cap: "w", lit: "o", body: "m", under: "l", rim: "c", deep: "C", lace: "ml",
}

function breakers(opts) {
  return [function (c) { breakersDraw(c, opts, opts.animate ? c.phase || 0 : 0) }]
}

/** Wash run-up 0..1 driven by spot i's collapsing wave: up quickly, drains slowly; 0 at rest. */
function breakerWash(opts, p, i) {
  var b = opts.spots[i === undefined ? opts.spots.length - 1 : i]
  var u = ((p + b.a0) % 1 + 1) % 1
  return u < 0.45 ? Math.pow(Math.sin(Math.PI / 2 * u / 0.45), 2) : Math.pow(Math.cos(Math.PI / 2 * (u - 0.45) / 0.55), 2)
}

function breakersDraw(c, o, p) {
  o.spots.forEach(function (b) {
    var a = ((p + b.a0) % 1 + 1) % 1
    ;[a, a + 1].forEach(function (age) { brkWave(c, o, b, age) }) // younger first, older over it
  })
}

function brkSmooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t) }

/** Where a wave of age a is: height scale, how far it has come in, where the peel has got to. */
function brkState(o, b, a) {
  var rise = brkSmooth(a < 1 ? a / 0.5 : 1 - (a - 1) / 0.6)
  return {
    rise: rise,
    adv: a < 1 ? -Math.round(10 * (1 - a)) : Math.round(14 * (a - 1)),
    at: b.from - b.broken * (o.peel || 470) * Math.max(0, a - 0.45),
  }
}

/** The age at which the peel reached column x (whitewater there from then on). */
function brkBrokeAt(o, b, x) { return 0.45 + (b.from - x) * b.broken / (o.peel || 470) }

function brkWave(c, o, b, a) {
  if (a <= 0 || a >= 2) return
  var K = Object.assign({}, BREAKER_KEYS, o.keys), s = brkState(o, b, a), W = 360
  var curlW = Math.round(b.h * 1.4)
  var col = o.column || function () { return 0 }
  // the crest fades in as the swell rises: no line, then a broken dim line, then a solid lit one
  var crestK = brkSmooth((s.rise - 0.12) / 0.45)
  for (var x = 0; x < W; x++) {
    var side = (x - s.at) * b.broken // > 0 broken, < -curlW clean, between: the curl
    var hh = Math.round(b.h * s.rise * (0.5 + 0.5 * Math.exp(-Math.abs(side) / 80)) * (0.9 + 0.2 * fbm1(b.seed + 30, x / 40)))
    var base = b.y + s.adv, top = base - hh
    if (side < -curlW) brkFace(c, K, b, x, top, base, hh, crestK, col)
    else if (side <= 0) brkCurl(c, K, b, x, top, base, hh, 1 + side / curlW, crestK)
  }
  brkWhitewater(c, o, K, b, a, s)
  brkSpray(c, o, K, b, a)
}

/** Clean face: backlit, dark steps from the crest down; the crest line fades in, hot in the light's path. */
function brkFace(c, K, b, x, top, base, hh, crestK, col) {
  if (hh < 1) return
  for (var y = top + 1; y <= base; y++) {
    var v = (y - top) / hh
    c.px(x, y, K.face[v < 0.3 ? 0 : v < 0.65 ? 1 : 2])
  }
  if (fbm1(b.seed + 20, x / 4, { octaves: 2 }) < 1.05 - 1.2 * crestK) { c.px(x, top, K.face[1]); return } // still dashed
  var hot = col(x, top)
  c.px(x, top, hot === 2 ? K.hot[0] : hot === 1 ? K.hot[1] : crestK > 0.5 ? K.crest : K.crestDim)
  if (crestK > 0.6) c.px(x, top - 1, hot ? K.lip[2] : K.crestBack)
}

/**
 * The curl, f 0 (clean end) .. 1 (broken end): the lip pitches up and throws forward. Front view:
 * the falling curtain (face colours) above, the lip's thick edge (2–3 px: bright rim, light,
 * tinted underside), and the dark hollow under it.
 */
function brkCurl(c, K, b, x, top, base, hh, f, crestK) {
  var lipTop = top - Math.round(2 * Math.sin(Math.PI * f))
  var th = f < 0.5 ? 3 : 2
  var lipY = lipTop + Math.round(Math.max(th - 1, hh * 0.85 * Math.pow(f, 1.3)))
  for (var y = lipTop; y <= base; y++) {
    var k
    if (y < lipY - th + 1) k = y - lipTop < 2 ? K.face[0] : K.face[1]          // the curtain
    else if (y <= lipY) k = K.lip[Math.min(2, y - (lipY - th + 1))]            // the lip, rim first
    else k = f > 0.15 ? K.hollow : K.face[(y - top) / Math.max(1, hh) < 0.65 ? 1 : 2] // the hollow
    c.px(x, y, k)
  }
  if (crestK < 0.6) c.px(x, lipTop, K.crestDim)
}

/**
 * Whitewater: billows along the broken stretch, each born when the peel passes it. A billow pops
 * up from the curl, swells and wobbles; once the wave has broken it shrinks, sinks and rolls
 * forward, so the top stays bumpy to the end. Each billow: dark rim at the bottom, shaded underside,
 * body, light then a cap on the side facing the light. In front: lace (a noise net) that thins out.
 */
function brkWhitewater(c, o, K, b, a, s) {
  var L = o.light || { x: 180, y: 0 }, wind = o.wind || 0, list = []
  var collapse = a < 1 ? 1 : Math.max(0, 1 - (a - 1) / 0.75)
  // the foam body: a continuous mass along the broken stretch, so billows sit on it, not apart
  for (var x = 0; x < 360; x++) {
    var e = a - brkBrokeAt(o, b, x)
    if (e < 0) continue
    var mh = Math.round(b.h * (0.35 + 0.25 * Math.min(1, e / 0.1)) * collapse * (0.75 + 0.5 * fbm1(b.seed + 310, x / 9 + a * 3)))
    if (mh < 2) continue
    // as it collapses the body tears into patches (and then lace), never a thin strip
    if (fbm1(b.seed + 320, x / 7 + a * 2, { octaves: 2 }) < (1 - collapse) * 0.9) continue
    var base = b.y + s.adv + Math.round((1 - collapse) * 3)
    for (var y = base - mh; y <= base; y++) {
      var d = y - (base - mh)
      c.px(x, y, y === base ? K.rim : d === 0 ? K.lit : d / mh > 0.6 ? K.under : K.body)
    }
  }
  for (var i = -2; i < 64; i++) {
    var bx = i * 6 + hash2(b.seed + 300, i, 0) * 6
    var e = a - brkBrokeAt(o, b, bx) // age since the peel passed here
    if (e < 0) continue
    var r0 = b.h * (0.3 + 0.32 * hash2(b.seed + 300, i, 1))
    var r = r0 * Math.min(1, 0.35 + e / 0.12) * collapse * (0.82 + 0.3 * Math.sin(2 * Math.PI * (e * 2.3 + hash2(b.seed + 300, i, 2))))
    if (r < 1.2) continue
    var settle = Math.min(1, e / 0.7)
    var cy = b.y + s.adv - b.h * 0.3 * collapse - r * 0.35 - b.h * s.rise * 0.35 * (1 - settle) + (1 - collapse) * 3
    var cx = bx + wind * 4 * e
    list.push([cx, cy, r])
    if (r > 3) list.push([cx + (hash2(b.seed + 301, i, 0) - 0.5) * r, cy - r * 0.55, r * (0.45 + 0.2 * hash2(b.seed + 301, i, 1))]) // a bump on top
  }
  list.sort(function (p, q) { return p[1] - q[1] }) // higher (further) first
  list.forEach(function (bl) {
    var cx = bl[0], cy = bl[1], r = bl[2], lx = L.x - cx, ly = L.y - cy, ll = Math.hypot(lx, ly) || 1
    lx /= ll; ly /= ll
    for (var y = Math.floor(cy - r); y <= cy + r; y++)
      for (var x = Math.floor(cx - r); x <= cx + r; x++) {
        var dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r, d = dx * dx + dy * dy
        if (d > 1) continue
        var lit = dx * lx + dy * ly, k
        if (dy > 0.75 && d > 0.6) k = K.rim
        else if (dy > 0.4) k = K.under
        else if (lit > 0.55 && d > 0.3) k = K.cap
        else if (lit > 0.15) k = K.lit
        else k = K.body
        c.px(x, y, k)
      }
  })
  // lace: a noise net on the water in front of the whitewater and behind the collapsing wave
  var laceK = a < 1 ? 0.8 : Math.max(0, 1 - (a - 1) / 0.9), base = b.y + s.adv
  if (laceK <= 0.02) return
  for (var y = base - 1; y < base + 7; y++)
    for (var x = 0; x < 360; x++) {
      if (a - brkBrokeAt(o, b, x) < 0.05) continue
      var n = fbm2(b.seed + 70, x / 4.5 + wind * a * 2, (y - s.adv) / 2.8, { octaves: 2 })
      var net = 1 - Math.abs(n - 0.5) * 11, need = 1 - laceK * (1 - (y - base + 1) * 0.1)
      if (net > need) c.px(x, y, net > need + 0.45 ? K.lace[0] : K.lace[1])
    }
}

/**
 * Spray torn off the lip by the wind: particles born along the peel point while the wave stands,
 * each living a few frames and blowing downwind as it falls; white, then light, then grey.
 */
function brkSpray(c, o, K, b, a) {
  var wind = o.wind || 0
  for (var j = 0; j < 36; j++) {
    var born = 0.5 + 0.7 * hash2(b.seed + 400, j, 0), life = 0.05 + 0.08 * hash2(b.seed + 400, j, 1)
    var t = (a - born) / life
    if (t < 0 || t >= 1) continue
    var sb = brkState(o, b, born), x0 = sb.at + b.broken * (2 + 8 * hash2(b.seed + 400, j, 2))
    var y0 = b.y + sb.adv - b.h * sb.rise - 1 - Math.round(2 * hash2(b.seed + 400, j, 3))
    var x = Math.round(x0 + wind * (5 + 14 * hash2(b.seed + 400, j, 4)) * t)
    var y = Math.round(y0 - (2 + 4 * hash2(b.seed + 400, j, 5)) * Math.sin(Math.PI * t * 0.8) + 3 * t * t)
    var k = t < 0.4 ? K.cap : t < 0.75 ? K.lit : K.body
    c.px(x, y, k)
    if (hash2(b.seed + 400, j, 6) > 0.6 && t < 0.6) c.px(x - wind, y, K.lit) // a short trail upwind
  }
}
