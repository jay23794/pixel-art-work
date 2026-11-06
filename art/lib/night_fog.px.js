// Fog for the night kit: stepped horizontal bands with wavy, hard edges, thickening toward the
// ground. The upper bands are veils: whatever is behind turns to the cool haze tone one step above
// its lightness (band 0), two steps (band 1), so shapes still show through but lose their hue and
// contrast, as in fog. Only the bottom band is a flat colour of one role. From weather-fx's ground fog, re-made as hard
// bands in palette colours (no alpha).
//   nightPalette("silver")
//   anim(..., fog({ top: 380, height: 120, role: "haze" }))
// Motion: each band sways sideways at its own phase and its edge morphs between two noise shapes.
// A one-way drift isn't loop-safe at fog speed (it would have to cross a whole noise period per
// loop, ~15 px/frame), so the sway + morph is the loop-safe "drift". Captures nightKeys() when called.
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
 */
function fog(opts) {
  var K = nightKeys(), cool = nightCool(K), o = opts || {}, top = o.top !== undefined ? o.top : 380, height = o.height || 120
  var nb = o.bands || 3, keys = K(NIGHT_FOG_ROLES[o.role || "haze"] || o.role), dens = o.density !== undefined ? o.density : 1
  var amp = o.amp !== undefined ? o.amp : 7, sway = o.sway !== undefined ? o.sway : 6, W = o.w || 360, seed = o.seed || 0
  // Periodic value noise in x (period W, cells of 40 px), 0..1, smooth between cells.
  function pn(s, x) {
    function one(cs, ss) {
      var n = Math.round(W / cs), fx = x / cs, i = Math.floor(fx), f = fx - i, u = f * f * (3 - 2 * f)
      var a = hash2(ss, ((i % n) + n) % n, 0), b = hash2(ss, (((i + 1) % n) + n) % n, 0)
      return a + (b - a) * u
    }
    return 0.65 * one(60, s) + 0.35 * one(20, s + 50)
  }
  return function (c) {
    var p = c.phase || 0, m = Math.cos(Math.PI * p) * Math.cos(Math.PI * p) // 1 → 0 → 1 over the loop
    // Band i starts at edge(i, x); edges step down from the top, each wavy, swaying, morphing.
    function edge(i, x) {
      var xs = x - Math.round(sway * Math.sin(2 * Math.PI * (p + i / nb))), s = 900 + seed * 13 + i * 2
      var v = pn(s, xs) * m + pn(s + 1, xs) * (1 - m)
      return Math.round(top + height * (i / nb) * (2 - dens) + amp * (v - 0.5) * 2)
    }
    var bottom = top + height, step = cool(c)
    for (var x = 0; x < W; x++) {
      var e = []
      for (var i = 0; i < nb; i++) e.push(edge(i, x))
      for (var y = Math.max(0, e[0]); y < bottom; y++) {
        var b = 0
        while (b + 1 < nb && y >= e[b + 1]) b++
        if (b === nb - 1) { c.px(x, y, keys[keys.length - 1]); continue }
        var k = step(c.get(x, y), b + 1)
        if (k) c.px(x, y, k)
      }
    }
  }
}
