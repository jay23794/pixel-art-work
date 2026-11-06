// Fireflies for the night kit: small glowing dots on smooth looping paths (Lissajous 1:2), each
// blinking at its own phase. Each is a stepped glow: an accent core, a 4-neighbour ring one chain
// step dimmer, and an outer ring of the surface stepped up its own ramp (no blur, no alpha).
// Extracted from jungle_night (its values are the defaults).
//   nightPalette("warm")
//   anim(..., fireflies({ near: [112, 400, 104, 56], far: [80, 286, 210, 100] }))
// Loops only (reads c.phase); a still has no fireflies. Captures nightKeys() when called.
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_lights.px.js")

/**
 * opts:
 *   count (10), the first half near, the rest far
 *   near / far: [x, y, w, h]  areas their path centres are scattered in
 *   path: { ax: [8, 12], ay: [4, 6] }  sway amplitude (base, random extra) in px
 *   keys: { core: "4", ring: "3" }     accent keys (warm: gold core, amber ring)
 *   halo (2.6): radius of the outer ring that steps the surface up once
 *   seed (96)
 */
function fireflies(opts) {
  var K = nightKeys(), o = opts || {}, n = o.count || 10, seed = o.seed || 96
  var near = o.near || [112, 400, 104, 56], far = o.far || [80, 286, 210, 100]
  var path = o.path || { ax: [8, 12], ay: [4, 6] }, keys = o.keys || { core: "4", ring: "3" }, halo = o.halo || 2.6
  var flies = []
  for (var i = 0; i < n; i++) {
    var a = i < n / 2 ? near : far
    flies.push({
      cx: a[0] + hash2(seed, i, 0) * a[2], cy: a[1] + hash2(seed, i, 1) * a[3],
      ax: path.ax[0] + hash2(seed, i, 2) * path.ax[1], ay: path.ay[0] + hash2(seed, i, 3) * path.ay[1],
      o1: hash2(seed, i, 4), o2: hash2(seed, i, 5), ob: i / n,
    })
  }
  return function (c) {
    var p = c.phase || 0
    flies.forEach(function (f) {
      if (Math.sin(2 * Math.PI * (p + f.ob)) < -0.25) return // blinking off
      var x = Math.round(f.cx + f.ax * Math.sin(2 * Math.PI * (p + f.o1))), y = Math.round(f.cy + f.ay * Math.sin(2 * Math.PI * (2 * p + f.o2)))
      c.light([x, y, halo], 1)
      var r = K(keys.ring)
      c.px(x - 1, y, r); c.px(x + 1, y, r); c.px(x, y - 1, r); c.px(x, y + 1, r)
      c.px(x, y, K(keys.core))
    })
  }
}
