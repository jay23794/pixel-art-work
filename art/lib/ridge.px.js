// Ridge profiles: one top-y per column, for skylines of hills, dunes and mountains.
// Needs lib/noise.px.js. Top-level `function`/`var` only (see art/CLAUDE.md).

/**
 * Top y of a ridge for every column x in [0, w).
 * o: { y: baseline, amp: height in px, scale: px per noise unit, seed, octaves, gain,
 *      sharp: 0 = rolling fBm, 1 = ridged peaks (1 - |2n - 1|), shape(x): extra px added to y }
 * Higher noise = higher ridge (smaller y).
 */
function ridgeProfile(w, o) {
  var out = new Array(w), sharp = o.sharp || 0, scale = o.scale || 80
  for (var x = 0; x < w; x++) {
    var n = fbm1(o.seed || 1, x / scale, { octaves: o.octaves || 4, gain: o.gain })
    var r = 1 - Math.abs(2 * n - 1)
    var v = n * (1 - sharp) + r * sharp
    out[x] = Math.round(o.y - v * o.amp + (o.shape ? o.shape(x) : 0))
  }
  return cleanProfile(out)
}

/**
 * Remove 1-px spikes and notches (a column that differs from both neighbours in the same
 * direction), which read as jaggies at 1× scale.
 */
function cleanProfile(p) {
  var q = p.slice()
  for (var x = 1; x < q.length - 1; x++) {
    var a = q[x - 1], b = q[x + 1]
    if ((q[x] < a && q[x] < b) || (q[x] > a && q[x] > b)) q[x] = Math.round((a + b) / 2)
  }
  return q
}

/** Filled polygon (for poly()) from a profile down to `bottom`. */
function ridgePoly(p, bottom, x0) {
  x0 = x0 || 0
  var pts = [x0, bottom]
  for (var x = 0; x < p.length; x++) pts.push(x0 + x, p[x], x0 + x + 1, p[x])
  pts.push(x0 + p.length, bottom)
  return pts
}

/** dy/dx of the profile at x over ±r columns (screen y: positive = descending to the right). */
function slopeAt(p, x, r) {
  r = r || 2
  var a = p[Math.max(0, x - r)], b = p[Math.min(p.length - 1, x + r)]
  return (b - a) / (Math.min(p.length - 1, x + r) - Math.max(0, x - r))
}
