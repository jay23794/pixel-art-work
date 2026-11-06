// Lightning for the night kit: one strike per loop, played from a fixed per-frame pattern. On the
// flash frames the whole sky steps up one palette step along its own ramps (no white overlay); the
// bolt is a midpoint-displacement line with thinner forks, inked by level (halo < body < core) so a
// fork's halo never covers the trunk. From pixelfx's lightning (MIT, after Sprite Fusion),
// re-made palette-locked. Captures nightKeys() when called.
//   nightPalette("silver")
//   anim("x", { frames: 48, fps: 12 }, ...sky, ground, lightning({ horizon: 420, bolt: { from: [180, 200], to: [214, 420] } }))
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_lights.px.js")

// Frame by frame from the strike: sky lift (steps) and bolt (2 full, 1 cooling channel, 0 none).
// Return stroke on frame 2. Two flash frames, never more than 3.
var NIGHT_LIGHTNING_PATTERN = [{ sky: 1, bolt: 2 }, { sky: 0, bolt: 1 }, { sky: 1, bolt: 2 }, { sky: 0, bolt: 1 }]

/**
 * Item drawing the strike from c.phase (a still shows phase 0: nothing unless `at` is 0). opts:
 *   frames (48): the loop length;  at: strike frame (default seeded)
 *   pattern: NIGHT_LIGHTNING_PATTERN;  horizon: sky is y < horizon, or sky(x, y) → bool
 *   bolt: { from: [x, y], to: [x, y], jag (0.3), forks (0.35) } or false
 *   keys: { core: "w", body: "5", halo: "3" } night keys;  seed (0)
 */
function lightning(opts) {
  var K = nightKeys(), o = opts || {}, n = o.frames || 48, seed = o.seed || 0
  var at = o.at !== undefined ? o.at : Math.floor(hash2(800 + seed, 0, 0) * n), pat = o.pattern || NIGHT_LIGHTNING_PATTERN
  var sky = o.sky || function (x, y) { return y < o.horizon }
  var ks = o.keys || { core: "w", body: "5", halo: "3" }, keys = [null, K(ks.halo), K(ks.body), K(ks.core)]
  var grid = o.bolt ? nightBolt(o.bolt, seed) : null
  return function (c) {
    var f = Math.round((c.phase || 0) * n) % n, k = (((f - at) % n) + n) % n
    if (k >= pat.length) return
    if (pat[k].sky) c.light(sky, pat[k].sky)
    if (!grid || !pat[k].bolt) return
    grid.forEach(function (lvl, key) {
      var cut = pat[k].bolt === 2 ? 1 : 2 // cooling channel: body and core only, core shown as body
      if (lvl < cut) return
      var xy = key.split(","), l = pat[k].bolt === 2 ? lvl : 2
      c.px(+xy[0], +xy[1], keys[l])
    })
  }
}

/**
 * Bolt pixels as a Map "x,y" → level (1 halo, 2 body, 3 core): a trunk by midpoint displacement
 * down to ~3 px segments, forks that split off and thin (core only), each with a 1 px halo.
 */
function nightBolt(b, seed) {
  var grid = new Map(), jag = b.jag || 0.3, forks = b.forks !== undefined ? b.forks : 0.35, R = 0
  function rnd() { return hash2(810 + seed, R++, 0) }
  function mark(x, y, l) { var k = x + "," + y; if ((grid.get(k) || 0) < l) grid.set(k, l) }
  function path(x0, y0, x1, y1, j) {
    var pts = [[x0, y0], [x1, y1]], off = Math.hypot(x1 - x0, y1 - y0) * j
    while (pts.length < 2 + Math.hypot(x1 - x0, y1 - y0) / 3) {
      var nx = [pts[0]]
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], c = pts[i + 1], l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, d = (rnd() * 2 - 1) * off
        nx.push([(a[0] + c[0]) / 2 - (c[1] - a[1]) / l * d, (a[1] + c[1]) / 2 + (c[0] - a[0]) / l * d], c)
      }
      pts = nx; off *= 0.52
    }
    return pts
  }
  function ink(pts, core) {
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], c = pts[i + 1], s = Math.max(Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), 1)
      for (var t = 0; t <= s; t++) {
        var x = Math.round(a[0] + (c[0] - a[0]) * t / s), y = Math.round(a[1] + (c[1] - a[1]) * t / s)
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) mark(x + dx, y + dy, 1)
        if (core) { mark(x + 1, y, 2); mark(x, y, 3) } else mark(x, y, 2)
      }
    }
  }
  var trunk = path(b.from[0], b.from[1], b.to[0], b.to[1], jag)
  ink(trunk, true)
  for (var i = 2; i < trunk.length - 3; i++)
    if (rnd() < forks / 4) {
      var p = trunk[i], q = trunk[i + 3], ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.55)
      var len = Math.hypot(b.to[0] - p[0], b.to[1] - p[1]) * (0.25 + rnd() * 0.3)
      ink(path(p[0], p[1], p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len, jag * 1.1), false)
    }
  return grid
}
