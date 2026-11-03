// Seeded value noise and fBm, pure JS. All results are in [0, 1).
// Lib file: top-level `function`/`var` only, so it can be included more than once (see art/CLAUDE.md).

/** Integer hash of (seed, x, y) → [0, 1). */
function hash2(seed, x, y) {
  var h = Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function _smooth(t) { return t * t * (3 - 2 * t) }
function _lerp(a, b, t) { return a + (b - a) * t }

/** 1D value noise at x (lattice every 1 unit). */
function vnoise1(seed, x) {
  var i = Math.floor(x)
  return _lerp(hash2(seed, i, 0), hash2(seed, i + 1, 0), _smooth(x - i))
}

/** 2D value noise at (x, y). */
function vnoise2(seed, x, y) {
  var i = Math.floor(x), j = Math.floor(y), u = _smooth(x - i), v = _smooth(y - j)
  return _lerp(_lerp(hash2(seed, i, j), hash2(seed, i + 1, j), u),
               _lerp(hash2(seed, i, j + 1), hash2(seed, i + 1, j + 1), u), v)
}

/** Fractal sum of vnoise1. o: { octaves = 4, lacunarity = 2, gain = 0.5 }. Normalised to [0, 1). */
function fbm1(seed, x, o) {
  o = o || {}
  var oct = o.octaves || 4, lac = o.lacunarity || 2, gain = o.gain === undefined ? 0.5 : o.gain
  var sum = 0, norm = 0, amp = 1, f = 1
  for (var k = 0; k < oct; k++) {
    sum += amp * vnoise1(seed + k * 101, x * f)
    norm += amp; amp *= gain; f *= lac
  }
  return sum / norm
}

/** Fractal sum of vnoise2. Same options as fbm1. */
function fbm2(seed, x, y, o) {
  o = o || {}
  var oct = o.octaves || 4, lac = o.lacunarity || 2, gain = o.gain === undefined ? 0.5 : o.gain
  var sum = 0, norm = 0, amp = 1, f = 1
  for (var k = 0; k < oct; k++) {
    sum += amp * vnoise2(seed + k * 101, x * f, y * f)
    norm += amp; amp *= gain; f *= lac
  }
  return sum / norm
}
