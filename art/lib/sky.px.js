// Shared sky: gradient, sun or moon with a stepped glow, stars, cumulus and stratus.
//   palette("dusk")
//   scene("x", { w: 360, h: 640 }, ...skyLayer("dusk"), ...ground items)
// The palette must match the time (skyLayer uses roles, the palette gives the colours).
// Approved: dusk, night. Sunrise and day still need a fix pass before a scene uses them.
// Needs lib/noise.px.js. Top-level `function`/`var` only (see art/CLAUDE.md).
include("noise.px.js")

var SKY_W = 360, SKY_H = 640
var SKY_HORIZON = 456 // reference horizon the layouts below are drawn for

// glow.r is the halo's reach beyond the disk edge (glow measures from every disk pixel).
// Cloud roles → palette keys: [bottom rim, underside, body, lit edge, highlight].
var SKY_TIMES = {
  sunrise: {
    sky: "UUDDddduuk",
    sun: { x: 110, y: 434, r: 20, cut: "u" }, glow: { r: 12, ramp: 1 },
    cloud: "LCclo",
    cumulus: [{ x: 196, y: 300, w: 134, h: 50, seed: 11 }, { x: 34, y: 236, w: 74, h: 26, seed: 12 }],
    stratus: [{ x: 150, y: 410, len: 200, th: 10, seed: 13 }, { x: 8, y: 380, len: 140, th: 8, seed: 14 },
              { x: 210, y: 350, len: 130, th: 7, seed: 15 }],
  },
  day: {
    sky: "UUDDDddduk",
    sun: { x: 268, y: 152, r: 14 }, glow: { r: 18, ramp: 2 },
    cloud: "LCclm",
    cumulus: [{ x: 38, y: 372, w: 206, h: 74, seed: 21 }, { x: 232, y: 282, w: 96, h: 36, seed: 22 }],
    stratus: [{ x: 20, y: 206, len: 160, th: 7, seed: 23 }],
  },
  dusk: {
    sky: "UUUDDddduk",
    sun: { x: 252, y: 434, r: 22, cut: "u" }, glow: { r: 22, ramp: 2 },
    cloud: "UDLuk", // backlit: slate body, plum underside, coral rim against the rose sky
    cumulus: [{ x: 30, y: 250, w: 150, h: 54, seed: 31 }],
    stratus: [{ x: 160, y: 414, len: 200, th: 9, seed: 32 }, { x: 0, y: 392, len: 170, th: 10, seed: 33 },
              { x: 196, y: 366, len: 140, th: 7, seed: 34 }],
  },
  night: {
    sky: "UUUUDDDddu",
    moon: { x: 112, y: 184, r: 18 }, glow: { r: 14, ramp: 1 },
    cloud: "LCclm",
    cumulus: [{ x: 196, y: 404, w: 128, h: 40, seed: 41 }],
    stratus: [{ x: 30, y: 210, len: 180, th: 8, seed: 42 }],
    stars: true,
  },
}

/**
 * The sky for one time of day, as a list of scene items (spread it into a scene).
 * Below the horizon the gradient's last colour carries on to the bottom; studies draw their
 * ground over it.
 * opts.horizon (default 456): scales the whole layout vertically (gradient, sun/moon, clouds,
 * star limit) so a study can put the horizon higher. Sizes don't scale.
 * opts.clouds (default: as designed): { scale, x, y, top } for cumulus. `scale` multiplies their
 * width and height (around their centre); `x`, `y` move the group so the first cumulus is centred
 * on x with its base on y (others keep their offsets); `top` then pushes a cloud down until its
 * highest puff is at or below that y (e.g. 84 keeps it out of the top safe zone).
 * `stratus: { hide: [i, ...] }` drops those stratus bands (by index in the time's list).
 * opts.sun / opts.moon (default: as designed): { x, y } puts the disk there (after horizon
 * scaling); stars still keep clear of the moon. opts.moon.crescent: { dx, dy } cuts the moon with
 * a same-sized disk offset by (dx, dy) px, leaving a crescent lit on the opposite side.
 * opts.stars (default: none): { maxY } leaves out stars below that y; the others stay put.
 *   { density } (default 1) > 1 adds more stars (every default star stays where it is).
 * opts.glow (default: the time's): { r, ramp } overrides the sun/moon halo; r: 0 draws none.
 * opts.layer (default: all): "back" leaves out the stars, "stars" returns only them, so a loop can
 *   stamp the still sky once and draw the (twinkling) stars per frame. The stars keep clear of
 *   the glow, so the two layers add up to the whole sky.
 * opts.motion (default: none, still image): for anims, read from c.phase so loops wrap:
 *   { clouds: px }  cumulus and stratus sway ±px sideways
 *   { twinkle: { n, maxY } }  n of the medium/bright stars above maxY dim and recover.
 */
function skyLayer(time, opts) {
  var T = skySetup(time, opts), light = T.sun || T.moon, mo = (opts && opts.motion) || {}
  function sway(c) { return mo.clouds ? Math.round(mo.clouds * Math.sin(2 * Math.PI * (c.phase || 0))) : 0 }
  var items = [
    grad(0, 0, SKY_W, T.horizon, T.sky, "v", 0.6),
    rect(0, T.horizon, SKY_W, SKY_H - T.horizon, T.sky[T.sky.length - 1]),
    function (c) { if (T.stars) skyStars(c, T.moon, T.starLimit, mo.twinkle, c.phase || 0, opts && opts.stars && opts.stars.maxY, opts && opts.stars && opts.stars.density) },
    function (c) { if (T.sun) skySunDisk(c, T.sun); else skyMoonDisk(c, T.moon) },
    // Crisp stepped halo: bands = ramp, so every ring is a whole ramp step (no dithered fractions).
    T.glow.r > 0 ? glow("onw", { r: T.glow.r, ramp: T.glow.ramp, bands: T.glow.ramp, where: [light.x, light.y, light.r + 1] }) : function () {},
    function (c) { if (T.sun && T.sun.cut) skySunCuts(c, T.sun) },
    function (c) {
      var dx = sway(c)
      T.stratus.forEach(function (s) { skyStratus(c, dx ? Object.assign({}, s, { x: s.x + dx }) : s, T.cloud, light) })
      T.cumulus.forEach(function (s) { skyCumulus(c, dx ? Object.assign({}, s, { x: s.x + dx }) : s, T.cloud, light) })
    },
  ]
  // opts.layer: "back" = everything but the stars (stamp it once), "stars" = only the stars (per frame)
  if (opts && opts.layer === "back") items[2] = function () {}
  if (opts && opts.layer === "stars") return [items[2]]
  return items
}

/** Where the sun (or moon) of skyLayer(time, opts) is: { x, y, r }. Studies light from it. */
function skyLight(time, opts) {
  var T = skySetup(time, opts)
  return T.sun || T.moon
}

/** The time's layout, scaled to opts.horizon. */
function skySetup(time, opts) {
  var src = SKY_TIMES[time]
  if (!src) throw new Error("unknown sky '" + time + "' (have: " + Object.keys(SKY_TIMES).join(", ") + ")")
  var horizon = (opts && opts.horizon) || SKY_HORIZON, f = horizon / SKY_HORIZON
  function at(o) { var p = Object.assign({}, o); p.y = Math.round(o.y * f); return p }
  return {
    sky: src.sky, cloud: src.cloud, glow: (opts && opts.glow) || src.glow, stars: src.stars, horizon: horizon,
    sun: src.sun && skyPlace(at(src.sun), opts && opts.sun), moon: src.moon && skyPlace(at(src.moon), opts && opts.moon),
    cumulus: skyCloudsFit(src.cumulus.map(at), opts && opts.clouds),
    stratus: src.stratus.map(at).filter(function (_, i) {
      return !(opts && opts.clouds && opts.clouds.stratus && (opts.clouds.stratus.hide || []).indexOf(i) >= 0)
    }),
    starLimit: Math.round((Math.round(SKY_H * 2 / 3) - 8) * f),
  }
}

/** Override a disk's position with opts { x, y }. */
function skyPlace(d, o) {
  if (!o) return d
  var p = Object.assign({}, d)
  if (o.x !== undefined) p.x = o.x
  if (o.y !== undefined) p.y = o.y
  if (o.crescent) p.crescent = o.crescent
  return p
}

/** Apply opts.clouds to the cumulus list: scale each, move the group, keep tops below `top`. */
function skyCloudsFit(list, o) {
  if (!o) return list
  var out = list.map(function (cu) {
    var p = Object.assign({}, cu), sc = o.scale || 1
    if (sc !== 1) {
      var cx = cu.x + cu.w / 2
      p.w = Math.round(cu.w * sc); p.h = Math.round(cu.h * sc); p.x = Math.round(cx - p.w / 2)
      p.y = Math.round(cu.y - (cu.h - p.h) / 2)
    }
    return p
  })
  if (out.length && (o.x !== undefined || o.y !== undefined)) {
    var dx = o.x !== undefined ? o.x - (out[0].x + out[0].w / 2) : 0, dy = o.y !== undefined ? o.y - out[0].y : 0
    out.forEach(function (p) { p.x = Math.round(p.x + dx); p.y = Math.round(p.y + dy) })
  }
  // Highest a puff can reach above the base: centre (0.4 r + 0.3 h) plus radius, r ≤ 0.72 h × 1.2.
  out.forEach(function (p) {
    var reach = Math.ceil(p.h * (0.3 + 0.72 * 1.2 * 1.4))
    if (o.top !== undefined && p.y - reach < o.top) p.y = o.top + reach
  })
  return out
}

// ---------------------------------------------------------------- sun and moon

/** Sun disk: white-hot body with a 2-px warm rim. */
function skySunDisk(c, s) {
  for (var dy = -s.r; dy <= s.r; dy++) {
    var hw = Math.round(Math.sqrt((s.r + 0.5) * (s.r + 0.5) - dy * dy))
    var hc = Math.round(Math.sqrt(Math.max(0, (s.r - 1.5) * (s.r - 1.5) - dy * dy)))
    c.hline(s.x - hw, s.y + dy, 2 * hw + 1, "o")
    if (hc > 0) c.hline(s.x - hc, s.y + dy, 2 * hc + 1, "w")
  }
}

/**
 * Cut-lines across a low sun's lower half (the sun seen through layers of haze over the horizon):
 * solid runs shrink while the gaps grow towards the horizon. Painted after the glow, in the
 * near-horizon sky colour, so the halo doesn't fill them in.
 */
function skySunCuts(c, s) {
  var y = Math.round(s.r * 0.1), solid = 5, gap = 1
  while (y <= s.r + 1) {
    y += solid
    for (var g = 0; g < gap; g++) {
      var dy = y + g
      if (dy > s.r) break
      var hw = Math.round(Math.sqrt((s.r + 0.5) * (s.r + 0.5) - dy * dy))
      c.hline(s.x - hw, s.y + dy, 2 * hw + 1, s.cut)
    }
    y += gap
    solid = Math.max(2, solid - 1)
    if (solid <= 3) gap = Math.min(4, gap + 1)
  }
}

/** Full moon: pale disk with darker maria (clusters from 2D noise), in the moon ramp. */
function skyMoonDisk(c, m) {
  for (var dy = -m.r; dy <= m.r; dy++)
    for (var dx = -m.r; dx <= m.r; dx++) {
      var d = Math.sqrt(dx * dx + dy * dy)
      if (d > m.r + 0.5) continue
      if (m.crescent && Math.hypot(dx - m.crescent.dx, dy - m.crescent.dy) <= m.r + 0.5) continue // the dark part
      var mare = fbm2(5, (dx + 40) / 9, (dy + 40) / 9, { octaves: 2 }) > 0.58
      c.px(m.x + dx, m.y + dy, mare ? "n" : "o")
    }
}

// ---------------------------------------------------------------- stars

/**
 * Night stars, 3 sizes: 1 px (dim), 2×2 (medium), 3×3 plus (bright); a few bright ones get a
 * long cross sparkle. Density falls off from the top; none below `limit` (the lower third at the
 * reference horizon), none in the moon's glow.
 */
function skyStars(c, moon, limit, twinkle, phase, maxY, density) {
  var tw = 0
  for (var i = 0; i < 900; i++) {
    var x = 4 + Math.floor(hash2(71, i, 0) * (SKY_W - 8))
    var y = 4 + Math.floor(hash2(71, i, 1) * limit)
    var keep = Math.pow(1 - y / limit, 1.8)
    if (hash2(71, i, 2) > keep * 0.32 * (density || 1)) continue
    if (maxY !== undefined && y > maxY) continue
    if (Math.hypot(x - moon.x, y - moon.y) < moon.r + 34) continue
    var size = hash2(71, i, 3)
    // Twinkle: the first n medium/bright stars above maxY dim for part of the loop, each at its
    // own offset (sin of the loop phase, so frame 23 flows into frame 0).
    if (twinkle && size >= 0.84 && y < twinkle.maxY && tw < twinkle.n) {
      var off = hash2(72, i, 0), dim = Math.sin(2 * Math.PI * (phase + off)) > 0.55
      tw++
      if (dim) { c.px(x, y, "l"); continue }
    }
    if (size < 0.84) c.px(x, y, size < 0.5 ? "l" : "m")
    else if (size < 0.96) c.rect(x, y, 2, 2, "n")
    else {
      c.rect(x - 1, y, 3, 1, "o"); c.rect(x, y - 1, 1, 3, "o"); c.px(x, y, "w")
      if (size > 0.985) // cross sparkle
        for (var k = 2; k <= 4; k++) {
          var key = k < 4 ? "n" : "m"
          c.px(x - k, y, key); c.px(x + k, y, key); c.px(x, y - k, key); c.px(x, y + k, key)
        }
    }
  }
}

// ---------------------------------------------------------------- clouds

/** Unit vector from (x, y) towards the light. */
function skyToLight(light, x, y) {
  var dx = light.x - x, dy = light.y - y, l = Math.hypot(dx, dy) || 1
  return [dx / l, dy / l]
}

/**
 * Cumulus: puffs over a flat base line `y`, painted back to front (puffs whose bottoms sit
 * higher are further away). Main puffs give the mass, smaller bumps on their tops give the
 * cauliflower silhouette. Shading is by edges, the pixel-art way, not by sphere gradients:
 *   lit crescent — the part of a puff within ~a quarter of its size of its edge towards the light,
 *   highlight    — the outermost pixel of that crescent on the cloud's silhouette,
 *   shadow       — a puff's lower part, and wherever a nearer puff blocks the light (occlusion),
 *   bottom       — 3 shaded rows above the flat base and a darker rim row on it.
 * o: { x, y (base line), w, h, seed }, keys: roles string, light: { x, y }.
 */
function skyCumulus(c, o, keys, light) {
  var n = Math.max(3, Math.round(o.w / 24)), blobs = []
  for (var i = 0; i < n; i++) {
    var t = (i + 0.5) / n, hump = Math.sin(Math.PI * t)
    var r = o.h * (0.26 + 0.46 * hump) * (0.8 + 0.4 * hash2(o.seed, i, 0))
    var b = {
      x: o.x + t * o.w + (hash2(o.seed, i, 1) - 0.5) * 10,
      y: o.y - r * 0.4 - hump * o.h * 0.3 + (hash2(o.seed, i, 2) - 0.5) * 6,
      rx: r * 1.15, ry: r,
    }
    blobs.push(b)
    // 1–2 bumps riding on the puff's upper edge.
    var m = 1 + Math.floor(hash2(o.seed, i, 3) * 2)
    for (var j = 0; j < m; j++) {
      var a = -Math.PI / 2 + (hash2(o.seed, i, 4 + j) - 0.5) * 2.0, rr = r * (0.34 + 0.16 * hash2(o.seed, i, 6 + j))
      blobs.push({ x: b.x + Math.cos(a) * b.rx * 0.78, y: b.y + Math.sin(a) * b.ry * 0.78, rx: rr * 1.15, ry: rr })
    }
  }
  // Back to front: puffs whose bottom edge is higher are further away.
  blobs.sort(function (p, q) { return (p.y + p.ry) - (q.y + q.ry) })
  // The cloud's light never comes from below the horizontal: a low sun lights its side,
  // and the underside stays shaded.
  var L = skyToLight(light, o.x + o.w / 2, o.y - o.h / 2)
  if (L[1] > -0.15) { L[1] = -0.15; var l = Math.hypot(L[0], L[1]); L = [L[0] / l, L[1] / l] }

  function inBlob(b, x, y) {
    var nx = (x + 0.5 - b.x) / b.rx, ny = (y + 0.5 - b.y) / b.ry
    return nx * nx + ny * ny <= 1 && y < o.y
  }
  function inAny(x, y, from) {
    for (var i = from; i < blobs.length; i++) if (inBlob(blobs[i], x, y)) return true
    return false
  }
  blobs.forEach(function (b, bi) {
    var lit = Math.max(3, Math.round(b.ry * 0.28))
    for (var y = Math.floor(b.y - b.ry); y < o.y; y++)
      for (var x = Math.floor(b.x - b.rx); x <= b.x + b.rx; x++) {
        if (!inBlob(b, x, y)) continue
        var ny = (y + 0.5 - b.y) / b.ry
        var tx = x + Math.round(L[0] * lit), ty = y + Math.round(L[1] * lit)
        var k = 2
        if (ny > 0.38) k = 1 // lower part of the puff turns away
        if (!inBlob(b, tx, ty)) {
          k = 3 // near this puff's edge towards the light
          var ex = x + Math.round(L[0] * 1.5), ey = y + Math.round(L[1] * 1.5)
          if (!inAny(ex, ey, 0)) k = 4 // on the cloud's own silhouette: rim highlight
        }
        // Occlusion: a nearer puff between this pixel and the light casts a shadow band
        // (several px wide, so it reads as shadow, not as an outline).
        for (var d = 2; d <= 10; d += 2)
          if (inAny(x + Math.round(L[0] * d), y + Math.round(L[1] * d), bi + 1)) { k = 1; break }
        var fromBase = o.y - 1 - y
        if (fromBase === 0) k = 0
        else if (fromBase < 3 && k > 1) k = 1
        c.px(x, y, keys[k])
      }
  })
}

/**
 * Stratus: a long thin band, tapered at both ends with a slow wave. The side facing the light
 * (its top when the light is above, its end when the light is level) is lit; the lower rows are
 * the shaded underside with a darker rim on the bottom row.
 */
function skyStratus(c, o, keys, light) {
  var L = skyToLight(light, o.x + o.len / 2, o.y)
  for (var i = 0; i < o.len; i++) {
    var t = i / (o.len - 1)
    var th = Math.round(o.th * Math.pow(Math.sin(Math.PI * t), 0.6) * (0.7 + 0.45 * fbm1(o.seed, i / 60, { octaves: 1 })))
    if (th < 2) continue // no 1-px slivers
    var x = o.x + i, top = o.y + Math.round(2 * Math.sin(i / 44 + o.seed)) - (th >> 1)
    var end = L[0] > 0 ? t : 1 - t // 1 at the end facing the light
    var endLit = Math.abs(L[0]) > 0.5 && end > 0.8
    for (var r = 0; r < th; r++) {
      var k = 2
      if (r === th - 1) k = th >= 4 ? 0 : 1
      else if (r >= th - 2 && th >= 4) k = 1
      else if (r === 0 && (L[1] < -0.3 || endLit)) k = endLit && end > 0.92 ? 4 : 3
      else if (endLit && r < th / 2) k = 3
      c.px(x, top + r, keys[k])
    }
  }
}
