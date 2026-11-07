// land_mountains — the mountains study's drawing as a land module (see lib/land.px.js). Moved verbatim
// from studies/mountains.px.js (which now calls it); light, depth and palette notes are in that study.
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("../palettes.px.js")
include("noise.px.js")
include("ridge.px.js")
include("sky.px.js")
include("night_sky.px.js")
include("land.px.js")

function landMountains() {

  var W = 360, H = 640
  // horizon 282 puts the dusk sun at y 268, in the notch; the cumulus is halved and kept below the
  // top safe zone so nothing competes with the hero peak.
  var SKY = { horizon: 282, clouds: { scale: 0.5, top: 96 } }
  var SUN = skyLight("dusk", SKY)
  // Night: the moon goes upper right, on the dusk sun's side, so the lit faces and the rim read as
  // moonlight; the cumulus moves to the left, away from the hero peak.
  var SKY_OPTS = {
    dusk: SKY,
    night: { horizon: 282, clouds: { scale: 0.5, top: 96, x: 64, y: 170 }, moon: { x: 276, y: 124 } },
  }
  // Loop motion (anims only): dusk clouds sway 1 px; night stars twinkle above the ranges.
  var SKY_MOTION = { dusk: { clouds: 1 }, night: { twinkle: { n: 7, maxY: 170 } } }

  /** Envelope of rounded cones: steep near each peak, flattening out (concave mountain slopes). */
  function cones(peaks) {
    return function (x) {
      var y = Infinity
      peaks.forEach(function (p) {
        var v = p.y + p.h * (1 - Math.exp(-Math.abs(x - p.x) / p.w))
        if (v < y) y = v
      })
      return y
    }
  }

  // Ridge profiles (top y per column): cone envelope + ridged fBm detail from lib/ridge.
  // Slope near a peak is h / w, so w ≈ h keeps faces near 45° instead of needles.
  var R1 = ridgeProfile(W, { y: 0, amp: 8, scale: 60, seed: 101, octaves: 3, sharp: 0.2,
    shape: cones([{ x: 70, y: 262, h: 30, w: 120 }, { x: 200, y: 268, h: 20, w: 90 }, { x: 330, y: 260, h: 30, w: 110 }]) })
  var R2 = ridgeProfile(W, { y: 0, amp: 12, scale: 40, seed: 202, octaves: 4, sharp: 0.5,
    shape: cones([{ x: 52, y: 196, h: 150, w: 150 }, { x: 186, y: 236, h: 90, w: 80 }, { x: 336, y: 206, h: 150, w: 100 }]) })
  var R3 = ridgeProfile(W, { y: 0, amp: 14, scale: 34, seed: 303, octaves: 4, sharp: 0.6,
    shape: cones([{ x: 30, y: 232, h: 170, w: 150 }, { x: 306, y: 238, h: 170, w: 160 }]) })
  var HERO = ridgeProfile(W, { y: 0, amp: 16, scale: 30, seed: 404, octaves: 4, sharp: 0.7,
    shape: cones([{ x: 142, y: 214, h: 270, w: 240 }, { x: 340, y: 292, h: 140, w: 120 }]) })
  var FORE = ridgeProfile(W, { y: 0, amp: 5, scale: 18, seed: 505, octaves: 3,
    shape: function (x) { return 484 - 34 * Math.exp(-x / 70) - 22 * Math.exp(-(W - x) / 50) } })

  // ---------------------------------------------------------------- range structure

  /** Peaks (local minima of y) and valleys (local maxima between them) of a profile. */
  function structure(P, minProm) {
    var peaks = [], valleys = []
    var s = P.map(function (_, x) { // smoothed copy so detail bumps don't count
      var a = 0, n = 0
      for (var i = -5; i <= 5; i++) { var xx = Math.max(0, Math.min(P.length - 1, x + i)); a += P[xx]; n++ }
      return a / n
    })
    for (var x = 1; x < s.length - 1; x++) {
      if (s[x] <= s[x - 1] && s[x] < s[x + 1]) peaks.push(x)
    }
    // keep prominent peaks only: higher than the lowest point towards each neighbour by minProm
    peaks = peaks.filter(function (p, i) {
      var l = i > 0 ? Math.max.apply(null, s.slice(peaks[i - 1], p + 1)) : Math.max.apply(null, s.slice(0, p + 1))
      var r = i < peaks.length - 1 ? Math.max.apply(null, s.slice(p, peaks[i + 1] + 1)) : Math.max.apply(null, s.slice(p))
      return Math.min(l, r) - s[p] >= minProm
    })
    for (var i = 0; i < peaks.length - 1; i++) {
      var best = peaks[i]
      for (var x = peaks[i]; x <= peaks[i + 1]; x++) if (s[x] > s[best]) best = x
      valleys.push(best)
    }
    return { peaks: peaks, valleys: valleys }
  }

  /** A line running down the face from (x0, y0): slant px per row, plus a slow seeded zig-zag. */
  function spineAt(x0, y0, slant, seed, y) {
    var d = Math.max(0, y - y0)
    var zig = (fbm1(seed, d / 26, { octaves: 2 }) - 0.5) * 2 * Math.min(10, d * 0.25)
    return x0 + slant * d + Math.round(zig / 2) * 2 // 2-px steps: clean clusters, no 1-px jaggies
  }

  /**
   * Per-pixel face info for a range. Spines run down from peaks, gullies from valleys; a face is
   * lit on the sun's side of its spine. Ribs (short side ridges branching off each spine) flip a
   * tapering wedge: a shadow wedge on the far side of a rib on a lit face, a lit wedge on the
   * near side of a rib on a shadow face. That breaks each face into solid clusters.
   */
  function faces(P, seed, minProm, ribs, small) {
    var st = structure(P, minProm)
    // Second-level ribs: short, narrow, spread across the lower face; they only cut shadow wedges
    // into lit rock (the shadow face gets its own detail).
    var smallRibs = []
    if (small) for (var j = 0; j < small.n; j++) {
      var y0 = Math.round(small.y0 + hash2(seed + 3, j, 0) * (small.y1 - small.y0 - 16))
      smallRibs.push({ x0: Math.round(small.x0 + hash2(seed + 3, j, 1) * (small.x1 - small.x0)), y0: y0,
        side: hash2(seed + 3, j, 2) > 0.5 ? 1 : -1, k: 0.6 + 0.4 * hash2(seed + 3, j, 3),
        len: 22 + Math.round(hash2(seed + 3, j, 4) * 18), w: 6 + Math.round(hash2(seed + 3, j, 5) * 4), seed: seed * 11 + j })
    }
    var spines = st.peaks.map(function (px, i) {
      var sp = { x: px, y: P[px], slant: (px < SUN.x ? -0.22 : 0.22), seed: seed + i, ribs: [] }
      for (var j = 0; j < (ribs || 0); j++) {
        var y0 = Math.round(sp.y + 22 + j * 34 + hash2(seed, i, j) * 12)
        sp.ribs.push({
          y0: y0, x0: spineAt(sp.x, sp.y, sp.slant, sp.seed, y0),
          side: j % 2 ? 1 : -1, k: 0.7 + 0.5 * hash2(seed, i, j + 10),
          len: 34 + Math.round(hash2(seed, i, j + 20) * 40), w: 7 + Math.round(hash2(seed, i, j + 30) * 7),
          seed: seed * 7 + i * 13 + j,
        })
      }
      return sp
    })
    var gullies = st.valleys.map(function (vx, i) {
      return { x: vx, y: P[vx], slant: (vx < SUN.x ? 0.1 : -0.1), seed: seed + 50 + i }
    })
    return {
      gullies: gullies,
      /** { lit, gully/spine: distance to the nearest gully / own spine, gullyDepth/spineDepth: rows below its start }. */
      at: function (x, y) {
        var k = 0, gd = Infinity, gdep = 0
        for (var i = 0; i < gullies.length; i++) {
          var g = gullies[i], gx = spineAt(g.x, g.y, g.slant, g.seed, y)
          if (y >= g.y && Math.abs(x - gx) < gd) { gd = Math.abs(x - gx); gdep = y - g.y }
          if (x > gx) k = i + 1
        }
        var s = spines[Math.min(k, spines.length - 1)]
        if (!s) return { lit: x < SUN.x, gully: gd, gullyDepth: gdep, spine: Infinity, spineDepth: 0 }
        var sx = spineAt(s.x, s.y, s.slant, s.seed, y)
        var lit = SUN.x > sx ? x >= sx : x < sx
        for (var r = 0; r < s.ribs.length; r++) {
          var b = s.ribs[r], dy = y - b.y0
          if (dy < 0 || dy > b.len) continue
          if ((x - sx) * b.side <= 0) continue // rib lies on its own side of the spine
          var bx = spineAt(b.x0 + b.side * b.k * dy, b.y0, 0, b.seed, y)
          var w = Math.max(2, Math.round(b.w * (1 - 0.7 * dy / b.len)))
          var away = SUN.x > bx ? -1 : 1 // direction away from the sun
          var off = (x - bx) * (lit ? away : -away)
          if (off >= 0 && off < w) { lit = !lit; break }
        }
        if (lit) for (var r = 0; r < smallRibs.length; r++) {
          var b = smallRibs[r], dy = y - b.y0
          if (dy < 0 || dy > b.len) continue
          var bx = spineAt(b.x0 + b.side * b.k * dy, b.y0, 0, b.seed, y)
          var off = (x - bx) * (SUN.x > bx ? -1 : 1), w = Math.max(1, Math.round(b.w * (1 - 0.6 * dy / b.len)))
          if (off >= 0 && off < w) { lit = false; break }
        }
        return { lit: lit, gully: gd, gullyDepth: gdep, spine: Math.abs(x - sx), spineDepth: y - s.y }
      },
    }
  }

  // ---------------------------------------------------------------- drawing

  /**
   * Draw one range. o: {
   *   P, seed, prom, ribs           profile, face seed, peak prominence, ribs per spine
   *   lit, shade                    rock keys for lit / shadow faces
   *   rim?, outline?, gully?        lit-ridge highlight, shadow-edge outline, gully crevice keys
   *   snow?: { line, lit, shade, crease?, rim?, broken? }   snowline y, keys, lit-ridge snow rim,
   *                                 broken lower edge
   *   haze?: [[y, key], ...]        stepped haze bands from y down, edges waving like mist
   *   hazeShift?                    px the mist edge is shifted sideways (loops)
   *   strata?: [litKey, shadeKey, y0, y1], strataDensity?(x, y) → threshold    hero only
   *   valley?: [y, key]             lit rock below y drops to key (valley shade)
   *   smallRibs?: { n, x0, x1, y0, y1 }   second-level ribs in that box (shadow wedges on lit rock)
   *   cracks?                       hero only
   * }
   */
  function drawRange(c, o) {
    var F = faces(o.P, o.seed, o.prom || 10, o.ribs, o.smallRibs)
    for (var x = 0; x < W; x++) {
      var top = o.P[x]
      for (var y = top; y < H; y++) {
        var f = F.at(x, y), d = y - top
        var k = f.lit ? o.lit : o.shade, snowy = false

        // Snow: down to the snowline (ragged in clusters), and further down the gullies.
        if (o.snow) {
          var edge = (fbm2(o.seed + 7, x / 8, y / 8, { octaves: 2 }) - 0.5) * 16
          var finger = Math.max(0, 40 - f.gully * 6) // gullies hold snow lower
          // Snow also runs down each spine (the ridge holds it), narrowing as it goes.
          var ridge = Math.max(0, 30 - f.spineDepth * 0.25) - f.spine * 4
          // Above the snowline, a few steep rock outcrops break through (hero only).
          var outcrop = o.snow.outcrops && y < o.snow.line - 6 && d > 10 &&
            fbm2(o.seed + 5, x / 11, y / 11, { octaves: 2 }) > 0.74
          // Broken lower edge: tongues of uneven width (4–6 px steps), and a few stray patches
          // a little below the line.
          var tw = Math.floor((x + Math.round(3 * Math.sin(x / 9))) / 5)
          var teeth = o.snow.broken ? Math.round((hash2(o.seed + 8, tw, 0) - 0.5) * 8 / 2) * 2 : 0
          var below = y - (o.snow.line + edge + teeth)
          var patch = o.snow.broken && below > 2 && below < 14 && fbm2(o.seed + 6, x / 6, y / 5) > 0.7
          if ((below < Math.max(finger, ridge) || patch) && !outcrop) {
            snowy = true
            k = f.lit ? o.snow.lit : o.snow.shade
            if (o.snow.crease && f.gully < 1 && y > top + 3) k = o.snow.crease
          }
        }

        if (!snowy) {
          // Crevice down each gully, fading out (broken) as it runs further below the valley.
          if (o.gully && f.gully < 1 && y > top + 2 && f.gullyDepth < 60 &&
              hash2(o.seed, x, y >> 2) > f.gullyDepth / 70) k = o.gully
          // Strata: bedding planes dipping left, every 13 px, only in a mid band of rock, broken.
          // On lit faces each is a ledge: a dark joint line with a lit lip just above it.
          if (o.strata && y > o.strata[2] && y < o.strata[3]) {
            var sy = y + Math.round(x * 0.2), m = ((sy % 13) + 13) % 13
            var thr = o.strataDensity ? o.strataDensity(x, y) : 0.5
            if (f.lit && fbm2(o.seed + 9, x / 14, Math.round(sy / 13)) > thr) {
              if (m === 0) k = o.strata[0]
              else if (m === 12) k = o.rim
            }
          }
        }

        // Valley shade: the lowest lit rock drops one step (the valley is out of the sun first).
        if (o.valley && f.lit && !snowy && y > o.valley[0] + Math.round(3 * Math.sin(x / 19))) k = o.valley[1]

        // Ridgeline: rim light on lit edges, deepShadow outline on shadow edges (hero only).
        if (d === 0) {
          if (f.lit && o.rim) k = snowy ? o.snow.rim || o.snow.lit : o.rim
          else if (!f.lit && o.outline) k = o.outline
        }

        // Haze bands towards the foot of the range (mist edge waves slowly).
        if (o.haze) {
          var wave = Math.round(3 * Math.sin((x - (o.hazeShift || 0)) / 23 + o.seed))
          for (var i = 0; i < o.haze.length; i++) if (y >= o.haze[i][0] + wave) k = o.haze[i][1]
        }
        c.px(x, y, k)
      }
    }
    if (o.cracks) o.cracks(c)
    if (o.detail) o.detail(c)
  }

  /** Joint cracks on the hero: three short zig-zags (2-px runs) down the lower lit rock. */
  function heroCracks(c) {
    [[176, 330, 1], [214, 352, -1], [98, 360, 1]].forEach(function (s, i) {
      var x = s[0]
      for (var n = 0; n < 14; n++) {
        c.px(x, s[1] + n, "B")
        if (n % 2 === 1 && hash2(77, i, n) > 0.45) x += s[2]
      }
    })
  }

  /** Distance from (x, y) to segment a→b, and t along it (0..1). */
  function segDist(x, y, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], t = ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)
    t = Math.max(0, Math.min(1, t))
    return { d: Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy), t: t, side: (x - a[0]) * dy - (y - a[1]) * dx }
  }

  // Long ledges on the lower hero face: [y at x = 0 along the dip, x0, x1].
  var HERO_LEDGES = [[436, 132, 226], [446, 246, 316], [478, 160, 262]]

  /**
   * Strata threshold (higher = sparser): dense near the peak and around the ledges, almost none in
   * the middle of the big lit areas, so the detail gathers where the eye should go.
   */
  function heroStrataDensity(x, y) {
    var nearPeak = Math.hypot((x - 150) / 1.6, y - 280) < 60
    var nearLedge = HERO_LEDGES.some(function (L) { return x >= L[1] - 10 && x <= L[2] + 10 && Math.abs(y - (L[0] - x * 0.2)) < 14 })
    return nearPeak ? 0.3 : nearLedge ? 0.42 : 0.82
  }

  /**
   * Hero detail painted over the drawn range (hero-only keys: b r t = lit rock, R = shadow rock).
   *  - Two ledges across the lower lit face, along the bedding dip, stepping down a pixel every
   *    so often like real bedding: lit lip (t), joint (B), 2 rows of overhang shadow (R).
   *  - Left shadow face: three clefts, short B wedges that taper down the face on the side away
   *    from the sun; and reflected light (r) at its foot, where the warm ground bounces light back
   *    up. Still shadow: r is one step above R and well below the lit b.
   */
  function heroDetail(c) {
    // Snow gullies: two shadowed runnels down the lit side of the cap, from the ridge.
    [[[154, 224], [166, 262], 3], [[176, 240], [192, 274], 2]].forEach(function (g) {
      for (var y = g[0][1]; y <= g[1][1] + 2; y++)
        for (var x = g[0][0] - 4; x <= g[1][0] + 4; x++) {
          var q = segDist(x, y, g[0], g[1])
          if (q.d < g[2] * (1 - 0.5 * q.t) && c.is(x, y, "k")) c.px(x, y, "h")
        }
    })
    HERO_LEDGES.forEach(function (L, i) {
      var step = 0
      for (var x = L[1]; x <= L[2]; x++) {
        if (x % 17 === 0 && hash2(61, i, x) > 0.5) step++ // bedding steps
        var y = L[0] - Math.round(x * 0.2) + step
        if (!c.is(x, y, "brt") || !c.is(x, y - 1, "brt")) continue
        var end = Math.min(x - L[1], L[2] - x) // taper the overhang towards the ends
        c.px(x, y - 1, "t"); c.px(x, y, "B")
        for (var k = 1; k <= (end > 8 ? 2 : 1); k++) if (c.is(x, y + k, "brt")) c.px(x, y + k, "R")
      }
    })
    var clefts = [[[30, 334], [52, 384], 9], [[70, 322], [90, 362], 7], [[14, 396], [34, 436], 7]]
    for (var y = 280; y < 480; y++)
      for (var x = 0; x < 140; x++) {
        if (!c.is(x, y, "R")) continue
        for (var i = 0; i < clefts.length; i++) {
          var q = segDist(x, y, clefts[i][0], clefts[i][1])
          if (q.side > 0 && q.d < clefts[i][2] * (1 - 0.85 * q.t) && q.t > 0 && q.t < 1) { c.px(x, y, "B"); break }
        }
        // Bounce light at the foot of the shadow face, ragged top edge in 2-px steps.
        var foot = 446 - Math.round(fbm1(62, x / 12) * 18 / 2) * 2
        if (y >= foot && c.is(x, y, "R")) c.px(x, y, "r")
      }
  }

  /**
   * Faceted boulder: a lit top plane, the face towards the sun, the face away from it, and a flat
   * cast shadow on the ground away from the sun. Vertices on pixel corners.
   */
  function boulder(c, x, base, bw, bh, seed) {
    var dir = SUN.x > x ? 1 : -1 // towards the sun
    var hw = Math.round(bw / 2), e = Math.round((hash2(seed, 0, 0) - 0.3) * bw * 0.3) * dir
    var BL = [x - hw, base], BR = [x + hw, base]
    var LS = [x - hw + Math.round(bw * 0.08), base - Math.round(bh * 0.55)]
    var RS = [x + hw - Math.round(bw * 0.1), base - Math.round(bh * 0.6)]
    var TL = [x - Math.round(bw * (0.22 + 0.1 * hash2(seed, 0, 1))), base - bh]
    var TR = [x + Math.round(bw * (0.18 + 0.1 * hash2(seed, 0, 2))), base - bh + Math.round(bh * 0.1)]
    var M = [x + e, base - Math.round(bh * 0.5)], Mb = [x + Math.round(e * 0.6), base]
    var away = dir > 0 ? BL : BR, len = Math.round(bw * 0.8)
    c.poly([away[0], base - 2, away[0] - dir * len, base - 1, away[0] - dir * len, base + 1, away[0], base + 2], "B")
    var flat = [].concat
    var sunFace = dir > 0 ? [M, RS, BR, Mb] : [LS, M, Mb, BL]
    var awayFace = dir > 0 ? [LS, M, Mb, BL] : [M, RS, BR, Mb]
    c.poly(flat.apply([], awayFace), "R")
    c.poly(flat.apply([], sunFace), "S")
    c.poly(flat.apply([], [LS, TL, TR, RS, M]), "s")
  }

  /**
   * Flat rock slab lying on the slope: an irregular plate (given outline) with a lit top plane,
   * a lit rim along its sun-facing edges, a 2-px front edge and a cast shadow away from the sun,
   * plus one crack across it.
   */
  function slab(c, pts, crack) {
    var cx = 0, n = pts.length / 2
    for (var i = 0; i < pts.length; i += 2) cx += pts[i] / n
    var dir = SUN.x > cx ? 1 : -1
    c.poly(pts.map(function (v, i) { return i % 2 ? v + 3 : v - dir * 3 }), "B") // cast shadow
    c.poly(pts.map(function (v, i) { return i % 2 ? v + 2 : v }), "R")            // front edge
    c.poly(pts, "S")                                                               // top plane
    // Rim: the top plane's pixels whose neighbour towards the sun is off the slab.
    var ys = pts.filter(function (_, i) { return i % 2 }), xs = pts.filter(function (_, i) { return !(i % 2) })
    for (var y = Math.min.apply(null, ys); y < Math.max.apply(null, ys); y++)
      for (var x = Math.min.apply(null, xs); x < Math.max.apply(null, xs); x++)
        if (c.is(x, y, "S") && !c.is(x + dir, y, "S") && !c.is(x + dir, y, "s") && c.is(x, y + 1, "SR")) c.px(x, y, "s")
    if (crack) for (var t = 0; t <= 1; t += 0.05) {
      var x = Math.round(crack[0] + (crack[2] - crack[0]) * t), y = Math.round(crack[1] + (crack[3] - crack[1]) * t)
      if (c.is(x, y, "S")) c.px(x, y, "R")
    }
  }

  /** Everything below the sky (ranges, haze, foreground). `shift` moves the mist edges sideways. */
  function landItems(shift) {
    return [
      function (c) {
        // R1: farthest, low and gentle. Two tones, no outline, almost the haze colour.
        drawRange(c, { P: R1, seed: 11, prom: 6, lit: "z", shade: "h" })
        // R2: lit far-light, shadow far-base; one step of haze at its foot.
        drawRange(c, { P: R2, seed: 21, prom: 10, ribs: 1, lit: "h", shade: "f", haze: [[258, "h"], [272, "z"]], hazeShift: shift })
        // R3: the range behind the hero, with snow.
        drawRange(c, { P: R3, seed: 31, prom: 10, ribs: 2, lit: "f", shade: "F",
          snow: { line: 270, lit: "z", shade: "h" }, haze: [[282, "f"], [296, "h"], [310, "z"]], hazeShift: shift })
        // HERO: full rock ramp, warm lit faces, purple shadows, snow, strata, cracks, outline.
        drawRange(c, { P: HERO, seed: 41, prom: 12, ribs: 5, lit: "b", shade: "R", rim: "t", outline: "B", gully: "B",
          snow: { line: 276, lit: "k", shade: "h", crease: "f", outcrops: true, rim: "w", broken: true },
          strata: ["r", "B", 290, 440], strataDensity: heroStrataDensity, cracks: heroCracks, detail: heroDetail,
          smallRibs: { n: 6, x0: 120, x1: 330, y0: 382, y1: 462 } })
      },
      // Foreground lip: darkest and warmest. Sand-ramp deep shadow body, lit tops facing the sun,
      // boulders breaking the lip line, stones growing towards the viewer.
      function (c) {
        for (var x = 0; x < W; x++) {
          var top = FORE[x], sl = slopeAt(FORE, x, 3)
          var facing = SUN.x > x ? sl < -0.05 : sl > 0.05
          for (var y = top; y < H; y++) c.px(x, y, y === top && facing ? "S" : "A")
        }
        // Grit: sparse lit grains on the scree (granular ground), denser towards the viewer.
        for (var i = 0; i < 420; i++) {
          var gx = Math.floor(hash2(93, i, 0) * W), gy = 496 + Math.floor(Math.sqrt(hash2(93, i, 1)) * 144)
          if (c.is(gx, gy, "A") && c.is(gx + 1, gy, "A")) c.rect(gx, gy, 2, 1, hash2(93, i, 2) > 0.3 ? "S" : "B")
        }
        // Scree runs: two trails of stones from the bottom corners converging on the lip below the
        // hero, shrinking with distance; they lead the eye up to the peak.
        var stones = [];
        [[[28, 636], [150, 500]], [[338, 636], [214, 500]]].forEach(function (run, ri) {
          // Clumps along the run, each a few stones of mixed size, spread wider near the viewer.
          for (var i = 0; i < 9; i++) {
            var t = Math.pow(i / 8, 0.8) + (hash2(94, ri, i) - 0.5) * 0.06
            var bx = run[0][0] + (run[1][0] - run[0][0]) * t, by = run[0][1] + (run[1][1] - run[0][1]) * t
            var m = 1 + Math.floor(hash2(94, ri, i + 10) * 3), spread = 18 - t * 12
            for (var j = 0; j < m; j++) {
              var sz = (8 - t * 5) * (0.5 + hash2(94, ri * 50 + i, j))
              stones.push({ x: bx + (hash2(95, ri * 50 + i, j) - 0.5) * spread, y: by + (hash2(96, ri * 50 + i, j) - 0.5) * spread * 0.4,
                rx: sz, ry: sz * 0.55 })
            }
          }
        })
        for (var i = 0; i < 16; i++) { // a few loose stones elsewhere
          var y = Math.round(500 + Math.sqrt(hash2(92, i, 1)) * 130), g = (y - 480) / 160, v = hash2(92, i, 2)
          stones.push({ x: hash2(92, i, 0) * W, y: y, rx: 2 + g * 5 + v * 4, ry: 1.5 + g * 2 + v * 2 })
        }
        stones.sort(function (a, b) { return a.y - b.y })
        stones.forEach(function (st) {
          var L = SUN.x > st.x ? 0.75 : -0.75
          for (var y = Math.floor(st.y - st.ry); y <= st.y + st.ry; y++)
            for (var x = Math.floor(st.x - st.rx); x <= st.x + st.rx; x++) {
              var nx = (x + 0.5 - st.x) / st.rx, ny = (y + 0.5 - st.y) / st.ry
              if (Math.abs(nx) * 0.55 + Math.abs(ny) * 0.45 + Math.max(Math.abs(nx), Math.abs(ny)) * 0.5 > 1) continue
              var k = ny > 0.6 ? "B" : ny < -0.35 + nx * L * 0.3 ? "s" : nx * L > 0 ? "S" : "A"
              c.px(x, y, k)
            }
        })
        // Slabs in the centre, long axes pointing up the slope towards the hero.
        // Broken plates: blunt, asymmetric, a short crack in from one edge.
        slab(c, [114, 534, 122, 518, 146, 512, 160, 516, 152, 530, 132, 538], [146, 513, 140, 524])
        slab(c, [210, 520, 216, 508, 236, 506, 240, 516, 226, 524])
        slab(c, [146, 578, 158, 560, 186, 552, 210, 558, 204, 570, 178, 584], [204, 562, 192, 570]);
        // Boulders on the lip: clumped, biggest towards the frame edges.
        [[12, 3], [72, 2], [270, 2], [346, 3]].forEach(function (g, gi) {
          for (var i = 0; i < g[1]; i++) {
            var bx = Math.round(g[0] + (i - (g[1] - 1) / 2) * 20 + (hash2(91, gi, i) - 0.5) * 10)
            var edge = Math.abs(bx - W / 2) / (W / 2), big = (0.5 + edge) * (0.7 + 0.6 * hash2(91, gi, i + 9))
            var cx = Math.max(0, Math.min(W - 1, bx))
            boulder(c, bx, FORE[cx] + 6 + i * 3, Math.round(16 + big * 18), Math.round(10 + big * 12), gi * 10 + i)
          }
        })
      },
    ]
  }

  /** Haze drift for loop phase p: -2..2 px, back and forth (sin, so frame 23 flows into 0). */
  function hazeShift(p) { return Math.round(1.5 * Math.sin(2 * Math.PI * p)) }

  /**
   * Snow shimmer (dusk loop): a few lit snow pixels on the hero cap flash to the bright rim
   * colour, each at its own point in the cycle.
   */
  function snowShimmer(c) {
    var n = 0
    for (var y = 214; y < 272 && n < 9; y++)
      for (var x = 146; x < 214 && n < 9; x++) {
        if (!c.is(x, y, "k") || !c.is(x + 1, y, "k") || hash2(81, x, y) > 0.012) continue
        n++
        if (Math.sin(2 * Math.PI * ((c.phase || 0) + hash2(82, x, y))) > 0.75) c.px(x, y, "w")
      }
  }

  /**
   * The study for one time of day. Everything below the sky is drawn identically for every time:
   * the palette swap alone recolours it (night = pure palette swap, no redrawing). The faces stay
   * lit from the dusk sun's position (SUN); at night the moon sits on that side.
   * The land is built once per haze offset as a part (_land_<time>_<shift>) and stamped, so the
   * loops don't redraw the mountains every frame. Stills stamp offset 0.
   */
  function mountainScene(time, o) {
    o = o || {}
    var P = nightOrPalette(time, o.accent || "silver", "night"), N = o.name || "mountains_" + time
    var sky = landSky(P, o), stage = landStage(o, time === "night")
    for (var sh = -2; sh <= 2; sh++) scene("_land_" + time + "_" + sh, { w: W, h: H }, ...landItems(sh))
    scene(N, { w: W, h: H, bg: "U" },
      ...sky(SKY_OPTS[time]),
      ...stage("sky", false),
      stamp("_land_" + time + "_0", 0, 0),
      ...P.end, ...stage("back", false), ...stage("front", false))
    // Seamless loop: 24 frames at 12 fps (2 s). Only haze, clouds, snow glints and stars move.
    anim(N + "_loop", { w: W, h: H, frames: landFrames(o, 24), fps: 12 }, ...landOwn(o, 24, [
      ...sky(Object.assign({}, SKY_OPTS[time], { motion: SKY_MOTION[time] })),
      ...stage("sky", true),
      function (c) { c.stamp("_land_" + time + "_" + hazeShift(c.phase), 0, 0) },
      function (c) { if (time === "dusk") snowShimmer(c) },
      ...P.end, ...stage("back", true), ...stage("front", true)]))
  }

  return { define: mountainScene, geo: { flies: function () { return null }, fliesWhy: "the mountains have no shore, bank or grass", horizon: 282, water: null, ground: 560, frames: 24, accent: "silver", legacy: "night", sky: SKY_OPTS.night } }
}
