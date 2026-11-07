// Reflections for the night kit: lights mirrored onto water or wet ground as broken vertical dashes
// that dim one accent step at a time, a glitter of moon dashes, and floating lights (boats: a light
// dot with its own short reflection, no boat shape). Extracted from harbour_night.
//   var refl = reflections({ source: city, top: 342, moon: { x: 98, y1: 480 }, boats: [...] })
//   function (c) { refl(c, null) }          // still;  refl(c, c.phase) in a loop (1 px shimmer)
// Captures nightKeys() when reflections() is called, so call it after nightPalette().
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_lights.px.js")

/**
 * opts:
 *   source: anything with .lights = [{ x, y, v }] (cityLights) or an array; read at draw time
 *   top: the waterline y; only lights with v ≥ minV (0.6) and y ≥ top - near (14) reflect
 *   moon: { x, y1, keys: ["N", "N"] }  glitter dashes from top + 6 down to y1 (omit = none)
 *   boats: [[x, y, v]]                 floating light dots, drifting ±1 px in a loop
 *   seed (0): offsets every hash, for a second reflection set in one scene
 */
function reflections(opts) {
  var K = nightKeys(), chain = K.state.chain, o = opts || {}, TOP = o.top
  var minV = o.minV !== undefined ? o.minV : 0.6, near = o.near !== undefined ? o.near : 14, s = o.seed || 0
  function key(v, ch) { return nightLightKey(K, v, ch || chain) }
  function shimmer(p, seed, a, b) {
    if (p === null || p === undefined) return 0
    var v = Math.sin(2 * Math.PI * (p + hash2(seed, a, b)))
    return v > 0.5 ? 1 : v < -0.5 ? -1 : 0
  }
  return function (c, p) {
    var list = Array.isArray(o.source) ? o.source : (o.source && o.source.lights) || []
    // Under every bright light near the waterline: short broken dashes, dimming one step at a time,
    // longer under the brightest.
    list.forEach(function (l, i) {
      if (l.v < minV || l.y < TOP - near) return
      var len = Math.round(10 + 60 * (l.v - 0.6) * (0.5 + hash2(55 + s, i, 0))), y = TOP + 3 + Math.round(hash2(56 + s, i, 0) * 9), v = l.v * 0.75
      while (y < TOP + len) {
        var dash = 1 + Math.round(hash2(57 + s, i, y) * 2)
        if (hash2(58 + s, i, y) > 0.25) c.rect(l.x + shimmer(p, 92 + s, i, y), y, 1, dash, key(v, l.ch))
        y += dash + 1 + Math.round(hash2(59 + s, i, y) * 3); v *= 0.88
      }
    })
    // Moon glitter: a few cool dashes under the moon, widening with distance.
    if (o.moon) {
      var mk = o.moon.keys || ["N", "N"]
      for (var y = TOP + 6; y < o.moon.y1; y += 4) {
        var hw = 3 + (y - TOP) * 0.12
        for (var k = 0; k < 2; k++) {
          var x = Math.round(o.moon.x - hw + hash2(60 + s, y, k) * 2 * hw)
          if (hash2(61 + s, y, k) > 0.4) c.rect(x + shimmer(p, 93 + s, y, k), y, 2 + Math.round(hash2(62 + s, y, k) * 3), 1, K(mk[k ? 1 : 0]))
        }
      }
    }
    // Boats: a light dot, a dimmer second light, and a short reflection; no boat shapes.
    ;(o.boats || []).forEach(function (b, bi, all) {
      var bx = b[0] + (p === null || p === undefined ? 0 : Math.round(Math.sin(2 * Math.PI * (p + bi / all.length))))
      c.rect(bx, b[1], 2, 1, key(b[2]))
      c.px(bx + 3, b[1] + 1, K(chain[Math.min(chain.length - 1, 3)]))
      for (var y = b[1] + 2; y < b[1] + 12; y += 3) if (hash2(63 + s, bi, y) > 0.3) c.rect(bx + shimmer(p, 94 + s, bi, y), y, 1, 2, key(b[2] * 0.6))
    })
  }
}
