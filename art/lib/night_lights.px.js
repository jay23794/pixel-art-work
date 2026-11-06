// Night lights for the night kit: point lights with a 5-ring stepped glow, light pools, lit windows,
// moonlight beams, and a flicker scheduler. No additive light: every ring is a flat palette colour
// (an accent key near the source, then the surface stepped up its own ramp). Techniques from
// docs/night-notes.md (nightcity's rings and flicker timing, re-made palette-locked).
//   nightPalette("warm")
//   scene("x", { ... }, ..., ...lights({ points: [{ x: 120, y: 300 }], windows: [...], animate: false }))
// Captures nightKeys() when lights() is called, so call it after nightPalette().
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_palette.px.js")
include("noise.px.js")

var NIGHT_RING_RADII = [1, 2, 4, 7, 11] // widening spacing (1, 2, 3, 4): rings get wider as they dim

/**
 * Scene items for a set of lights. opts:
 *   points:  [{ x, y, radii?, paint?, chain?, id? }]  5-ring stepped glow (see lightRings)
 *   pools:   [{ x, y, rx, ry, tint?, id? }]           light thrown on the ground (see lightPool)
 *   windows: [{ x, y, w, h, id? }]                    lit panes, big ones dimmer (see litWindow)
 *   flicker: { rate: 0.03, frames: 24, seed: 0 }      see nightFlicker; ids default to the index
 *   animate: true reads c.phase (loops); false/absent = still, every light lit.
 */
function lights(opts) {
  var K = nightKeys(), chain = K.state.chain, fl = opts.flicker || {}
  function lvl(c, id) { return opts.animate ? nightFlicker(id, c.phase || 0, fl) : 0 }
  return [function (c) {
    ;(opts.pools || []).forEach(function (o, i) { lightPool(c, K, o, lvl(c, o.id !== undefined ? o.id : 1000 + i), chain) })
    ;(opts.windows || []).forEach(function (o, i) { litWindow(c, K, o, lvl(c, o.id !== undefined ? o.id : 2000 + i), chain) })
    ;(opts.points || []).forEach(function (o, i) { lightRings(c, K, o, lvl(c, o.id !== undefined ? o.id : i), chain) })
  }]
}

/**
 * Point light: 5 rings at widening radii (NIGHT_RING_RADII). The outer rings step the surface up its
 * own ramp (+1 in the outermost, +2 inside the next); the inner `paint` rings (default 3) are flat
 * accent keys along the chain, core first. Dropped (lvl 1): every painted ring one chain step
 * dimmer and the outermost lift is gone.
 */
function lightRings(c, K, o, lvl, chain) {
  var radii = o.radii || NIGHT_RING_RADII, paint = o.paint !== undefined ? o.paint : 3, ch = o.chain || chain
  for (var i = radii.length - 1; i >= paint; i--) {
    if (lvl && i === radii.length - 1) continue
    c.light([o.x, o.y, radii[i] + 0.5], 1)
  }
  for (var j = paint - 1; j >= 0; j--) {
    var key = K(ch[Math.min(ch.length - 1, j + (lvl || 0))])
    nightDisc(c, o.x, o.y, radii[j], key)
  }
}

/**
 * Light pool on the ground: an ellipse (rx, ry) in hard bands. The whole pool steps the surface up
 * once, the inner half once more, and the core (inner quarter) takes the chain's second-dimmest
 * key (tint: false = none, or a night key). Dropped: no core tint, no inner lift.
 */
function lightPool(c, K, o, lvl, chain) {
  var tint = o.tint === false ? null : K(o.tint || chain[chain.length - 2])
  function band(s) { return function (x, y) { var dx = (x + 0.5 - o.x) / (o.rx * s), dy = (y + 0.5 - o.y) / (o.ry * s); return dx * dx + dy * dy <= 1 } }
  c.light(band(1), 1)
  if (!lvl) c.light(band(0.55), 1)
  if (tint && !lvl) {
    var inCore = band(0.25)
    for (var y = Math.floor(o.y - o.ry); y <= o.y + o.ry; y++)
      for (var x = Math.floor(o.x - o.rx); x <= o.x + o.rx; x++) if (inCore(x, y)) c.px(x, y, tint)
  }
}

/**
 * Lit window: a pane in one accent key. Brightness reads by area, so big panes get dimmer keys:
 * ≤ 2 px chain[0] (core), ≤ 6 chain[1], ≤ 24 chain[2], bigger chain[3]. Dropped: one step dimmer.
 */
function litWindow(c, K, o, lvl, chain) {
  var a = o.w * o.h, step = a <= 2 ? 0 : a <= 6 ? 1 : a <= 24 ? 2 : 3
  c.rect(o.x, o.y, o.w, o.h, K(chain[Math.min(chain.length - 1, step + (lvl || 0))]))
}

/** Filled disc of radius r (r = 0: one pixel), in one key. */
function nightDisc(c, x, y, r, key) {
  for (var dy = -r; dy <= r; dy++)
    for (var dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= (r + 0.5) * (r + 0.5)) c.px(x + dx, y + dy, key)
}

/** A light's accent key from its brightness 0..1 (the chain, core first). */
function nightLightKey(K, v, chain) {
  var i = v > 0.93 ? 0 : v > 0.6 ? 1 : v > 0.25 ? 2 : 3
  return K(chain[Math.min(chain.length - 1, i)])
}

/**
 * Flicker scheduler: 0 = lit, 1 = dropped, for light `id` at loop phase p (null = still: lit).
 * Most lights never change: only `rate` of them (default 3%, picked from the seed) have one burst
 * per loop, 2–6 frames long, toggling dropped/lit every frame, starting at their own seeded frame,
 * so nothing is synchronised. o: { rate, frames (loop length, default 24), seed }.
 */
function nightFlicker(id, p, o) {
  o = o || {}
  if (p === null || p === undefined) return 0
  var rate = o.rate !== undefined ? o.rate : 0.03, n = o.frames || 24, s = o.seed || 0
  if (hash2(301 + s, id, 0) >= rate) return 0
  var len = 2 + Math.floor(hash2(302 + s, id, 0) * 5), start = Math.floor(hash2(303 + s, id, 0) * n)
  var k = (((Math.round(p * n) - start) % n) + n) % n
  return k < len && k % 2 === 0 ? 1 : 0
}

/**
 * Moonlight beam (shafts through a canopy gap, light through a window): every pixel where
 * level(x, y) > 0 is redrawn in the cool beam ramp (sky → haze → moon), stepped `level` steps above
 * the beam colour nearest its own lightness (level(x, y, c): 0 none, 1, 2...; o.lift: steps per
 * level, default [0, 1, 2]; [0, 0, 1] = edges only turn cool, the core one step brighter). So whatever the beam crosses (teal leaves, violet
 * ground) turns silvery-blue instead of brighter in its own hue. Works before or after
 * nightRemap() (old colours are read as their night colour). Returns an item.
 */
var NIGHT_BEAM_RAMP = "UDLCNclno"
function lightBeam(level, o) {
  var K = nightKeys(), lift = (o && o.lift) || [0, 1, 2], cool = nightCool(K)
  return function (c) {
    var step = cool(c)
    for (var y = 0; y < c.h; y++)
      for (var x = 0; x < c.w; x++) {
        var n = level(x, y, c)
        if (!n) continue
        var k = step(c.get(x, y), lift[Math.min(n, lift.length - 1)])
        if (k) c.px(x, y, k)
      }
  }
}

/**
 * Cool-step lookup for beams and fog: nightCool(K)(c) gives step(colour, n) → the key n steps above
 * the NIGHT_BEAM_RAMP colour nearest the colour's lightness (null for a colour not in the palette).
 * Old colours (legacy mode) are read as their night colour.
 */
function nightCool(K) {
  var S = K.state, ramp = NIGHT_BEAM_RAMP.split(""), L = ramp.map(function (k) { return nightLightness(S.hex[k]) })
  return function (c) {
    var base = new Map()
    function add(col, hex) {
      var l = nightLightness(hex), best = 0
      for (var i = 1; i < L.length; i++) if (Math.abs(L[i] - l) < Math.abs(L[best] - l)) best = i
      base.set(col >>> 0, best)
    }
    Object.keys(S.hex).forEach(function (nk) { add(c.color(S.keys[nk]), S.hex[nk]) })
    if (S.remap) Object.keys(S.remap).forEach(function (o) { add(c.color(o), S.hex[S.remap[o]]) })
    return function (col, n) {
      var b = base.get(col >>> 0)
      return b === undefined ? null : K(ramp[Math.min(ramp.length - 1, b + n)])
    }
  }
}

/** OKLab lightness (0..1) of "#rrggbb". */
function nightLightness(h) {
  var v = [1, 3, 5].map(function (i) { var u = parseInt(h.slice(i, i + 2), 16) / 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4) })
  var l = Math.cbrt(0.4122214708 * v[0] + 0.5363325363 * v[1] + 0.0514459929 * v[2])
  var m = Math.cbrt(0.2119034982 * v[0] + 0.6806995451 * v[1] + 0.1073969566 * v[2])
  var s = Math.cbrt(0.0883024619 * v[0] + 0.2817188376 * v[1] + 0.6299787005 * v[2])
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
}

/**
 * Run an item n times per loop: it sees c.phase · n (mod 1). For scenes whose loop is one long
 * cycle (fog `drift`: e.g. 72 frames = 6 s) while faster modules (rain, ripples) keep their own
 * short cycle: nightRepeat(rain({...}), 3) repeats a 2 s rain loop three times. Give frame-counting
 * modules (lightning, meteor) frames = loop frames / n.
 */
function nightRepeat(item, n) {
  return function (c) {
    var cc = Object.create(c)
    Object.defineProperty(cc, "phase", { value: ((c.phase || 0) * n) % 1 })
    return item(cc)
  }
}
