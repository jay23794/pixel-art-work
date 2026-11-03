// hello — smoke test: dithered dusk sky over a shaded hill.
// Light: the setting sun, low on the right (x 252, on the horizon). Faces turned right are lit;
// faces turned left and the hill's body are in shadow (backlit dusk).
include("../palettes.px.js")
include("../lib/noise.px.js")
include("../lib/ridge.px.js")
include("../lib/dither.px.js")
palette("dusk")

var W = 360, H = 640
var HORIZON = 428 // lower third line
var SUN = { x: 252, y: 424, r: 15 }

// Distant range on the horizon: low and flat, `far` ramp only.
var FAR = ridgeProfile(W, { y: HORIZON + 6, amp: 22, scale: 70, seed: 7, octaves: 3 })

// Near hill on the left that runs out into a plain on the right.
var HILL = ridgeProfile(W, {
  y: 474, amp: 12, scale: 40, seed: 3, octaves: 3,
  shape: function (x) { return -132 * Math.exp(-Math.pow((x - 84) / 118, 2)) },
})

// Smoothed light per column: how squarely each stretch of the hill faces the sun (0..1).
// Averaging over ±10 columns keeps the lit band's lower edge a smooth contour, not drips.
var LIT = HILL.map(function (_, x) {
  var sum = 0, n = 0
  for (var i = -10; i <= 10; i++) {
    var xx = Math.max(0, Math.min(W - 1, x + i))
    sum += slopeAt(HILL, xx, 3); n++
  }
  var s = sum / n
  return s > 0 ? Math.min(1, s * 2.4) : 0
})

// Sky brightness: rises towards the horizon, plus a wide flat swell around the sun
// (the sky is brightest where it scatters the sun's light, wider than tall).
function skyValue(x, y) {
  var base = Math.pow(Math.min(1, y / HORIZON), 1.25)
  var dx = (x - SUN.x) / 150, dy = (y - SUN.y) / 70
  return Math.min(1, base + 0.28 * Math.exp(-(dx * dx + dy * dy)))
}

// Wind ripples on the sand. Near the crest they follow the hill's contour; further down they
// relax towards the flat plain. Spacing and thickness grow towards the viewer (perspective).
// Each crest catches the low sun on its back (s) and drops into a shaded trough (A).
function ripples(c) {
  for (var i = 0; i < 9; i++) {
    var t = i / 8, off = Math.round(24 + Math.pow(t, 1.5) * 150), thick = 1 + Math.floor(t * 2.2)
    var ys = new Array(W), on = new Array(W)
    for (var x = 0; x < W; x++) {
      var follow = 1 - t * 0.85
      var y = Math.round(HILL[x] * follow + (480 + off * 0.2) * (1 - follow)) + off
      y += Math.round((1.5 + t * 2) * Math.sin(x / (30 + i * 6) + i * 1.7))
      var band = Math.round(3 + 26 * LIT[x])
      ys[x] = y
      on[x] = y < H - 1 && y - HILL[x] >= band + 6 && // stay off the lit crest band
        fbm1(40 + i, x / (18 + i * 4), { octaves: 2 }) >= 0.5 // ripples break up
    }
    // Drop fragments shorter than 6 px: they read as orphan specks, not ripples.
    for (var x0 = 0; x0 < W; ) {
      if (!on[x0]) { x0++; continue }
      var x1 = x0
      while (x1 < W && on[x1]) x1++
      if (x1 - x0 >= 6)
        for (var x = x0; x < x1; x++) {
          // Crests only catch the sun where the dune faces it (or on the open plain);
          // on the face turned away there is only the shaded trough.
          var sunny = LIT[x] > 0 || slopeAt(HILL, x, 6) > -0.15
          if (sunny) c.px(x, ys[x], "s")
          for (var k = 1; k <= (sunny ? thick : 1); k++) c.px(x, ys[x] + k, "A")
        }
      x0 = x1
    }
  }
}

// First stars, in the darkest sky away from the sun.
var STARS = [[38, 34], [96, 61], [151, 22], [62, 118], [203, 47], [27, 166], [128, 141]]

scene("hello", { w: W, h: H, bg: "U" },
  // Sky: deep violet at the top to apricot at the horizon, dithered seams between ramp steps.
  function (c) {
    for (var y = 0; y < HORIZON + 40; y++)
      for (var x = 0; x < W; x++) c.px(x, y, rampKey(x, y, skyValue(x, y), "UDduk", 0.4))
  },
  function (c) { STARS.forEach(function (p) { c.px(p[0], p[1], "l") }) },
  // Sun disk with a white-hot core.
  circ(SUN.x, SUN.y, SUN.r, "o"),
  circ(SUN.x, SUN.y, SUN.r - 4, "w"),
  // Far range: shadow body, haze gathering towards its foot (lighter, same ramp).
  function (c) {
    for (var x = 0; x < W; x++)
      for (var y = FAR[x]; y < H; y++) {
        var d = y - FAR[x]
        c.px(x, y, d < 10 ? "F" : ditherKey(x, y, Math.min(1, (d - 10) / 16), "F", "f"))
      }
  },
  // The sun lights the haze on the range right beside it (one ramp step, in palette).
  glow("ow", { r: 34, ramp: 1 }),
  // Hill: lit band on right-facing slopes, rim on the crest, deep-shadow edge where it turns away.
  function (c) {
    for (var x = 0; x < W; x++) {
      var y0 = HILL[x], L = LIT[x], s = slopeAt(HILL, x, 3)
      var band = Math.round(3 + 26 * L)
      for (var y = y0; y < H; y++) {
        var d = y - y0, k = "S"
        if (d === 0) k = L > 0.35 ? "g" : s < -0.1 ? "A" : "s"
        else if (d < band * 0.4) k = "a"
        else if (d < band) k = "s"
        c.px(x, y, k)
      }
    }
  },
  ripples,
)

// Pipeline test only (not the art animation): the stars twinkle on a 24-frame, 2 s loop.
// Each star dims for 4 frames, at its own offset in the cycle.
anim("hello_loop", { w: W, h: H, frames: 24, fps: 12 },
  stamp("hello", 0, 0),
  function (c) {
    STARS.forEach(function (p, i) {
      if ((c.frame + i * 7) % 24 < 4) c.px(p[0], p[1], "c")
    })
  },
)
