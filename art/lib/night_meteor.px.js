// Meteor for the night kit: one streak with a stepped tail, crossing once per loop. The path is
// rasterised once (one Bresenham line), and the head moves along it pixel by pixel, so the streak
// keeps the same clean stairs while it moves. The tail grows in as the meteor enters and burns out
// at the end. Captures nightKeys() when called.
//   nightPalette("silver")
//   anim("x", { frames: 48, fps: 12 }, ...sky, meteor({ from: [60, 120], to: [230, 250] }))
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_lights.px.js")

/**
 * Item drawing the meteor from c.phase (nothing outside its crossing). opts:
 *   from, to: [x, y]       the path (head travels from → to)
 *   frames (48): loop length;  at: first frame (default seeded);  dur (7): frames it is visible
 *   tail: [2, 4, 7, 12]     run lengths behind the head, one per key after the head key
 *   keys ("wonN"): head, then tail steps (night keys, bright → dim)
 *   seed (0)
 */
function meteor(opts) {
  var K = nightKeys(), o = opts || {}, n = o.frames || 48, dur = o.dur || 7, seed = o.seed || 0
  var at = o.at !== undefined ? o.at : Math.floor(hash2(850 + seed, 0, 0) * n)
  var tail = o.tail || [2, 4, 7, 12], keys = K(o.keys || "wonN")
  var path = nightLine(o.from[0], o.from[1], o.to[0], o.to[1]), full = tail.reduce(function (a, b) { return a + b }, 0)
  return function (c) {
    var f = Math.round((c.phase || 0) * n) % n, k = (((f - at) % n) + n) % n
    if (k >= dur) return
    var head = Math.round((k + 1) / dur * (path.length - 1))
    // Grows in over the first frames, burns out (shorter, dimmer) on the last one.
    var len = Math.min(full, head), dim = k === dur - 1 ? 1 : 0
    for (var d = 0; d <= len; d++) {
      var seg = 0, acc = 0
      if (d > 0) { while (seg < tail.length && d > acc + tail[seg]) acc += tail[seg++]; seg++ }
      var ki = seg + dim
      if (ki >= keys.length) break
      var pt = path[head - d]
      c.px(pt[0], pt[1], keys[ki])
    }
  }
}

/** Pixels of a Bresenham line from (x0, y0) to (x1, y1), in order. */
function nightLine(x0, y0, x1, y1) {
  var out = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy
  for (;;) {
    out.push([x0, y0])
    if (x0 === x1 && y0 === y1) break
    var e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
  return out
}
