// Fog for the night kit: stepped horizontal bands with wavy, hard edges, thickening toward the
// ground. The upper bands are veils: whatever is behind turns to the cool haze tone one step above
// its lightness (band 0), two steps (band 1), so shapes still show through but lose their hue and
// contrast, as in fog. Only the bottom band is a flat colour of one role. From weather-fx's ground fog, re-made as hard
// bands in palette colours (no alpha).
//   nightPalette("silver")
//   anim(..., fog({ top: 380, height: 120, role: "haze" }))
// Motion (motion option):
//   "sway" (default): each band sways sideways at its own phase and its edge morphs between two
//     noise shapes; loop-safe in any loop length.
//   "drift": the bands move one way by `drift` px per loop (the lowest band twice as fast, for
//     depth). Seamless at any distance: two copies of the fog, the second `drift` px ahead, both
//     move and cross-fade from the first to the second over the loop, so the last frame is the
//     first again. Use the longest loop (72 frames of 360×640 = 6 s; a 12 s reel is two cycles):
//     drift 90 = 1.25 px/frame (~15 px/s, reads as fog), 180 = 2.5 px/frame (reads as sliding).
//     Run faster modules inside it with nightRepeat().
// Captures nightKeys() when called.
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_lights.px.js")

var NIGHT_FOG_ROLES = { haze: "Cc", sky: "uk", teal: "fh", moon: "Nn", ground: "Ss" }

/**
 * Item drawing fog from c.phase (a still shows phase 0). opts:
 *   top (380), height (120): the fog layer; bands split it, densest at the bottom
 *   bands (3): veils (band 0 cool +1, band 1 cool +2, ...), the last band a flat role colour
 *   role ("haze"): colour role, NIGHT_FOG_ROLES (haze, sky, teal, moon, ground) or night keys
 *   density (1): 0..1, how far down each band edge sits (lower density = thinner bands)
 *   amp (7): edge waviness in px;  sway (6): sideways sway in px per loop;  w (360);  seed (0)
 *   motion ("sway" | "drift"), dir (1 = drift right, -1 = left), drift (90): px per loop,
 *   period (w): noise period in px (shape size), a multiple of 60, or 90
 *   ragged (false): true = the bottom edge is wavy too (the same drifting/swaying noise as the band
 *   edges, its own seed), so a veil band never ends in a straight line (front fog)
 *   solid (true): false = veils only, densest in the middle (+1, +2, …, +1): no flat band and no hard
 *   bottom edge, so lights and reflections show through (mist over a lit bay)
 */
function fog(opts) {
  var K = nightKeys(), cool = nightCool(K), o = opts || {}, top = o.top !== undefined ? o.top : 380, height = o.height || 120
  var nb = o.bands || 3, keys = K(NIGHT_FOG_ROLES[o.role || "haze"] || o.role), dens = o.density !== undefined ? o.density : 1
  var amp = o.amp !== undefined ? o.amp : 7, sway = o.sway !== undefined ? o.sway : 6, W = o.w || 360, seed = o.seed || 0
  var P = o.period || W
  if (P % 60 && P !== 90) throw new Error("fog: period must be a multiple of 60, or 90, got " + P)
  var CELLS = P % 60 ? [P / 3, P / 9] : [60, 20] // big and small noise cells; 90 → 30, 10
  // Periodic value noise in x (period P: cells CELLS, 60 and 20 px), 0..1, smooth between cells.
  function pn(s, x) {
    function one(cs, ss) {
      var n = Math.round(P / cs), fx = x / cs, i = Math.floor(fx), f = fx - i, u = f * f * (3 - 2 * f)
      var a = hash2(ss, ((i % n) + n) % n, 0), b = hash2(ss, (((i + 1) % n) + n) % n, 0)
      return a + (b - a) * u
    }
    return 0.65 * one(CELLS[0], s) + 0.35 * one(CELLS[1], s + 50)
  }
  return function (c) {
    var p = c.phase || 0, m = Math.cos(Math.PI * p) * Math.cos(Math.PI * p) // 1 → 0 → 1 over the loop
    // Band i starts at edge(i, x); edges step down from the top, each wavy, swaying, morphing.
    function shape(s, xs) { return pn(s, xs) * m + pn(s + 1, xs) * (1 - m) }
    function edge(i, x) {
      var s = 900 + seed * 13 + i * 2, v
      if (o.motion === "drift") {
        // Two copies D px apart, both moving D per loop, cross-fading first → second (seamless).
        var D = (o.drift !== undefined ? o.drift : 90) * (i === nb - 1 ? 2 : 1) * (o.dir || 1)
        var a = shape(s, x - Math.round(p * D)), b = shape(s, x - Math.round(p * D) + D)
        v = 0.5 + ((a * (1 - p) + b * p) - 0.5) / Math.sqrt((1 - p) * (1 - p) + p * p) // keep the edge's waviness
      } else v = shape(s, x - Math.round(sway * Math.sin(2 * Math.PI * (p + i / nb))))
      return Math.round(top + height * (i / nb) * (2 - dens) + amp * (v - 0.5) * 2)
    }
    var bottom = top + height, step = cool(c)
    for (var x = 0; x < W; x++) {
      var e = []
      for (var i = 0; i < nb; i++) e.push(edge(i, x))
      var end = o.ragged ? Math.min(c.h, edge(nb + 1, x) - Math.round(height * (2 - dens) / nb)) : bottom // edge(nb + 1) ≈ bottom + one band
      for (var y = Math.max(0, e[0]); y < end; y++) {
        var b = 0
        while (b + 1 < nb && y >= e[b + 1]) b++
        if (b === nb - 1 && o.solid !== false) { c.px(x, y, keys[keys.length - 1]); continue }
        var k = step(c.get(x, y), o.solid === false && b === nb - 1 ? 1 : Math.min(b + 1, 2))
        if (k) c.px(x, y, k)
      }
    }
  }
}
