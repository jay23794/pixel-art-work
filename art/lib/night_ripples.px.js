// Ripples for the night kit: rain rings on wet ground and puddles, from the Rain Drop floor shader
// (grid of cells, seeded start time per cell) and pixelfx's rain-splash, re-made as stepped 1 px
// ellipse outlines in palette colours (no refraction, no alpha).
//   nightPalette("warm")
//   anim(..., ripples({ area: [0, 480, 360, 120], mask: inPuddle }))           // rings
//   anim(..., ripples({ area: [0, 340, 360, 120], mode: "light" }))            // breaks reflections
// Loop-safe: each cell's rings start at seeded phases and live a fixed share of the loop, so
// age(p) wraps with the loop. Captures nightKeys() when called.
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_lights.px.js")

/**
 * Item drawing ripples from c.phase (a still shows phase 0). opts:
 *   area: [x, y, w, h]   where ring centres sit (cells tile it)
 *   cell: [28, 12]       cell size; one ring centre per cell, seeded inside it
 *   per (1): rings per cell per loop;  life (0.4): share of the loop a ring lives
 *   rmax (7): final half-width in px;  ratio (3): width : height (a floor seen at an angle)
 *   keys ("nlC"): night keys fresh → old (rings step down as they spread)
 *   mask(x, y): only draw where true (puddles); default everywhere in the area
 *   mode: "ring" (default) draws the rings; "light" only touches accent pixels (reflections from
 *     reflections()): the crest one accent step brighter, the inside shifted 1 px sideways, so
 *     the dashes break up where a ring passes
 *   seed (0)
 */
function ripples(opts) {
  var K = nightKeys(), o = opts || {}, A = o.area, cell = o.cell || [28, 12]
  var per = o.per || 1, life = o.life || 0.4, rmax = o.rmax || 7, ratio = o.ratio || 3
  var keys = K(o.keys || "nlC"), mode = o.mode || "ring", seed = o.seed || 0, mask = o.mask
  var acc = "12345", neon = K.state.accent === "neon", accent = null // accent colour → index (light mode)
  var cols = Math.ceil(A[2] / cell[0]), rows = Math.ceil(A[3] / cell[1])
  return function (c) {
    var p = c.phase || 0
    if (mode === "light") { accent = new Map(); for (var a = 0; a < 5; a++) accent.set(c.color(K(acc[a])) >>> 0, a) }
    for (var cj = 0; cj < rows; cj++)
      for (var ci = 0; ci < cols; ci++)
        for (var k = 0; k < per; k++) {
          var sd = 700 + seed, id = cj * 1000 + ci
          var start = hash2(sd, id, k) , age = ((((p - start - k / per) % 1) + 1) % 1) / life
          if (age >= 1) continue
          // Centres stay inside the area (the last row/column of cells may overhang it).
          var cx = Math.min(A[0] + A[2] - 1, A[0] + ci * cell[0] + Math.floor(hash2(sd + 1, id, k) * cell[0]))
          var cy = Math.min(A[1] + A[3] - 1, A[1] + cj * cell[1] + Math.floor(hash2(sd + 2, id, k) * cell[1]))
          if (mask && !mask(cx, cy)) continue
          var rx = 1 + (rmax - 1) * Math.pow(age, 0.7), ry = Math.max(0.6, rx / ratio)
          ring(c, cx, cy, rx, ry, age, id * 7 + k)
        }
  }
  function inside(x, y, cx, cy, rx, ry) { var dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5); return dx * dx + dy * dy <= 1 }
  function ring(c, cx, cy, rx, ry, age, id) {
    var key = keys[Math.min(keys.length - 1, Math.floor(age * keys.length))], edits = []
    for (var y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        if (!inside(x, y, cx, cy, rx, ry) || (mask && !mask(x, y))) continue
        var edge = !inside(x + 1, y, cx, cy, rx, ry) || !inside(x - 1, y, cx, cy, rx, ry) || !inside(x, y + 1, cx, cy, rx, ry) || !inside(x, y - 1, cx, cy, rx, ry)
        if (mode === "ring") {
          // Old rings break into dashes before they vanish.
          if (edge && !(age > 0.5 && hash2(731, id, x * 64 + y) < (age - 0.5) * 1.6)) c.px(x, y, key)
          continue
        }
        // Light mode: only reflection (accent) pixels change. Collect first, apply after, so the
        // sideways shift reads the original pixels.
        var here = accent.get(c.get(x, y) >>> 0)
        if (edge && here !== undefined) {
          var up = neon ? (here <= 2 ? Math.min(2, here + 1) : Math.min(4, here + 1)) : Math.min(4, here + 1)
          edits.push([x, y, K(acc[up])])
        } else if (!edge) {
          var dir = y < cy ? 1 : -1, from = c.get(x + dir, y) >>> 0
          if (accent.has(from) || here !== undefined) edits.push([x, y, from])
        }
      }
    edits.forEach(function (e) { c.px(e[0], e[1], e[2]) })
  }
}
