// Rain for the night kit: slanted streaks in 4 depths (far = short, pale, slow; near = long, bright,
// fast), techniques from docs/night-notes.md (weather-fx's slanted space, pixelfx's depths, trips
// and gusts), re-made hard-edged and palette-locked.
//   nightPalette("silver")
//   anim(..., rain({ angle: 0.25, wind: 0.5, ground: 500 }))
// Slanted space: a streak's pixel in row y sits at x0 + floor(slant · y) for the ABSOLUTE row y, so
// every streak steps on the same stair grid as it falls: clean, regular runs, no jitter. The angle
// snaps to 1/n (n whole) so the runs are regular (n rows, 1 px across).
// Loop-safe: each drop slot falls a whole number of trips per loop, somewhere new each trip
// (positions hash the slot and the trip index mod trips), so the last frame flows into the first.
// Captures nightKeys() when called, so call it after nightPalette().
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_lights.px.js")

// Far → near: how many slots, streak length, fall distance per trip, trips per loop, keys (tail,
// body, head; night keys), whether the drop reaches the ground (else it ends in the air).
var NIGHT_RAIN_LAYERS = [
  { n: 260, len: 2, fall: 60, trips: 4, keys: "ccc", ground: false },
  { n: 170, len: 4, fall: 90, trips: 4, keys: "Ccl", ground: false },
  { n: 100, len: 7, fall: 130, trips: 4, keys: "cll", ground: true },
  { n: 46, len: 13, fall: 180, trips: 4, keys: "lnn", ground: true },
]

/**
 * Item drawing rain from c.phase (a still shows phase 0). opts:
 *   area: [x, y, w, h] (whole canvas)  where drops fall
 *   angle (0.25): slant, px across per px down (+ = falling to the right); snaps to 1/n
 *   density (1): share of slots that fall
 *   wind (0): 0..1, gusts: sheets of lighter rain sweeping across once per loop
 *   ground: y where the near layers land (default: the area's bottom); far layers end above it
 *   layers: override NIGHT_RAIN_LAYERS;  seed (0)
 */
function rain(opts) {
  var K = nightKeys(), o = opts || {}, A = o.area || [0, 0, 360, 640]
  var a = o.angle !== undefined ? o.angle : 0.25, n = a ? Math.max(1, Math.round(1 / Math.abs(a))) : 0
  var slant = n ? (a < 0 ? -1 : 1) / n : 0
  var dens = o.density !== undefined ? o.density : 1, wind = o.wind || 0, seed = o.seed || 0
  var ground = o.ground !== undefined ? o.ground : A[1] + A[3], layers = o.layers || NIGHT_RAIN_LAYERS
  var span = A[2] + Math.ceil(Math.abs(slant) * A[3]) // slots cover the skewed area
  return function (c) {
    var p = c.phase || 0
    layers.forEach(function (L, li) {
      var sd = 500 + seed * 7 + li, keys = K(L.keys)
      for (var i = 0; i < L.n; i++) {
        var off = hash2(sd, i, 0), t = p * L.trips + off, j = ((Math.floor(t) % L.trips) + L.trips) % L.trips, u = t - Math.floor(t)
        if (hash2(sd, i, j * 4 + 1) >= dens) continue
        var x0 = A[0] + Math.floor(hash2(sd, i, j * 4 + 2) * span) - (slant > 0 ? Math.ceil(slant * A[3]) : 0)
        // Gusts: a sine sheet sweeping across once per loop thins the rain where it is low.
        if (wind && hash2(sd, i, j * 4 + 3) > 1 - wind * (0.5 - 0.5 * Math.sin(2 * Math.PI * (x0 / 180 - p)))) continue
        var end = L.ground ? ground - Math.floor(hash2(sd, i, j * 4 + 4) * 6) : A[1] + Math.floor(hash2(sd, i, j * 4 + 4) * (ground - A[1] - 8))
        var head = Math.round(end - L.fall + u * L.fall)
        for (var r = 0; r < L.len; r++) {
          var y = head - r
          if (y < A[1] || y >= A[1] + A[3] || y > end) continue
          var x = x0 + Math.floor(slant * y)
          if (x < A[0] || x >= A[0] + A[2]) continue
          c.px(x, y, keys[r === 0 ? 2 : r === L.len - 1 ? 0 : 1])
        }
      }
    })
  }
}
