// Bayer 4×4 ordered dithering, the same matrix pxl uses for dither()/grad()/density.
// Top-level `function`/`var` only (see art/CLAUDE.md).

var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Threshold in (0, 1) for pixel (x, y). */
function bayer4(x, y) {
  return (BAYER4[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] + 0.5) / 16
}

/** `b` where the pixel's threshold is below t (t = share of b, 0..1), else `a`. */
function ditherKey(x, y, t, a, b) {
  return bayer4(x, y) < t ? b : a
}

/**
 * Pick a key from a ramp string ("UDduk") for a continuous value v in [0, 1] across it.
 * `soft` (0..1) is the share of each band that dithers into the next key; 0 = hard bands.
 * Only ever mixes two adjacent keys, as the art direction requires.
 */
function rampKey(x, y, v, keys, soft) {
  var n = keys.length - 1, s = Math.max(0, Math.min(n, v * n)), i = Math.floor(s)
  if (i >= n) return keys[n]
  var f = s - i, edge = 1 - (soft || 0)
  if (f <= edge) return keys[i]
  return ditherKey(x, y, (f - edge) / (1 - edge), keys[i], keys[i + 1])
}
