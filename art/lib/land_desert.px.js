// land_desert — the desert study's drawing as a land module (see lib/land.px.js). Moved verbatim
// from studies/desert.px.js (which now calls it); light, depth and palette notes are in that study.
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("../palettes.px.js")
include("noise.px.js")
include("ridge.px.js")
include("sky.px.js")
include("night_sky.px.js")
include("land.px.js")

function landDesert() {

  var W = 360, H = 640
  var HORIZON = 330
  // Cumulus moved to the upper right, away from the mesa, and kept below the top safe zone.
  // The stratus band that would sit on the mesa's top (index 1) is dropped.
  var SKY = { horizon: HORIZON, clouds: { scale: 0.6, top: 96, x: 286, y: 168, stratus: { hide: [1] } } }
  var SUN = skyLight("dusk", SKY)
  // Night: the moon upper right on the sun's side, so the lighting stays correct; the cumulus goes
  // to the upper middle-left, well above the mesa.
  var SKY_OPTS = {
    dusk: SKY,
    night: { horizon: HORIZON, moon: { x: 262, y: 150 }, clouds: { scale: 0.5, top: 96, x: 118, y: 150 } },
  }

  // ---------------------------------------------------------------- far plain and far mesas

  /** Small far mesas: flat tops, pale far-ramp body, a lit edge on the sun's side, no outline. */
  var FAR_MESAS = [
    { x0: 196, x1: 222, top: 308, cap: 9 },
    { x0: 290, x1: 326, top: 300, cap: 12 },
  ]
  function farMesas(c) {
    FAR_MESAS.forEach(function (m) {
      for (var y = m.top; y < HORIZON + 4; y++) {
        // slightly sloped sides: the mesa widens by 1 px every 3 rows below its cap
        var grow = Math.max(0, Math.floor((y - m.top - m.cap) / 2))
        for (var x = m.x0 - grow; x <= m.x1 + grow; x++) {
          var sunSide = SUN.x > (m.x0 + m.x1) / 2 ? x > m.x1 + grow - 3 : x < m.x0 - grow + 3
          c.px(x, y, sunSide ? "z" : "h")
        }
      }
    })
  }

  /**
   * Far plain with heat haze: hard stepped bands from the horizon down, palest at the horizon (the
   * hot air there takes the sky's colour), stepping down the sand ramp towards the viewer. The bases
   * of the far mesas dissolve into the first bands.
   */
  var HAZE = [[HORIZON - 4, "z"], [HORIZON, "k"], [HORIZON + 4, "g"], [HORIZON + 10, "a"], [HORIZON + 22, "s"]]
  function farPlain(c, phase) {
    for (var y = HORIZON - 4; y < H; y++)
      for (var x = 0; x < W; x++) {
        if (y < HORIZON && !c.is(x, y, "hz")) continue // above the horizon: only the mesa bases
        var k = null
        for (var i = 0; i < HAZE.length; i++) {
          // Loops: band edges below the horizon shimmer, a wave travelling sideways (±1–2 px).
          var wob = phase === undefined || i === 0 ? 0 : Math.round(1.5 * Math.sin(x / 6 + i * 1.7 + 2 * Math.PI * phase))
          if (y >= HAZE[i][0] + wob) k = HAZE[i][1]
        }
        c.px(x, y, k)
      }
  }

  // ---------------------------------------------------------------- hero mesa

  // Hero mesa geometry: caprock + vertical cliff (top..bench), then a concave skirt of softer rock
  // and talus flaring out to the foot (base). One continuous silhouette, no separate apron.
  var MESA = { x0: 58, x1: 168, top: 292, bench: 360, base: 432, flareL: 50, flareR: 54,
    cracks: [[70, 0.7], [88, 0.45], [109, 0.95], [127, 0.6], [146, 0.85], [160, 0.5]], // x, share of cliff
    strata: [311, 326, 337, 352], // cliff bedding lines (uneven, like real beds)
  }

  function skirt(y) { return Math.pow(Math.max(0, y - MESA.bench) / (MESA.base - MESA.bench), 1.7) }
  /** Which bed (between strata lines) a cliff row belongs to; harder beds stand out, softer ones recede. */
  function bedOf(y) { var b = 0; MESA.strata.forEach(function (s) { if (y >= s) b++ }); return b }
  function bedStep(y, side) { return y < MESA.bench ? Math.round((hash2(23, bedOf(y), side) - 0.5) * 4) : 0 }
  function mesaLeft(y) { return MESA.x0 - Math.round(MESA.flareL * skirt(y)) - bedStep(y, 0) }
  function mesaRight(y) { return MESA.x1 + Math.round(MESA.flareR * skirt(y)) + bedStep(y, 1) }
  function mesaTop(x) { return MESA.top + Math.round((fbm1(21, x / 11) - 0.5) * 6 / 2) * 2 } // caprock steps

  /**
   * Hero mesa. Cliff: caprock (lit band, bright top edge, dark line under its overhang), bedding
   * lines offset a pixel at each crack (small faults), vertical cracks with a lit wall on the sun's
   * side and a shadow wall on the other, a narrow lit return face on the sun's side and a shadow edge
   * on the far side. Skirt: a dark line at the cliff foot, then softer rock lit on the sun's side,
   * with short broken rills running down the fall lines (spreading out as the skirt flares) and a
   * few boulders near the foot.
   */
  function heroMesa(c) {
    var sunRight = SUN.x > (MESA.x0 + MESA.x1) / 2
    var RILLS = 13
    for (var y = MESA.top - 4; y <= MESA.base; y++) {
      var L = mesaLeft(y), R = mesaRight(y)
      for (var x = L; x <= R; x++) {
        if (y < mesaTop(x)) continue
        var d = y - mesaTop(x), k
        if (y < MESA.bench) {
          k = "r"
          if (d === 0) k = "t"
          else if (d < 6) k = "b"
          else if (d === 6) k = "B"
          else {
            // Light falls off away from the sun and down the cliff, in solid bands per bed: each
            // lower bed has a narrower lit part.
            var share = 0.62 - 0.1 * bedOf(y), t = (x - L) / Math.max(1, R - L)
            if (sunRight ? t > 1 - share : t < share) k = "b"
          }
          if (MESA.strata.indexOf(y - (faultAt(x) ? 1 : 0)) >= 0) k = k === "b" ? "r" : "R"
          else if (MESA.strata.indexOf(y + 1 - (faultAt(x) ? 1 : 0)) >= 0 && bedStep(y, 0) + bedStep(y, 1) > 0) k = "b" // ledge lip
          if ((sunRight ? x > R - 6 : x < L + 6) && d > 0) k = d < 6 ? "t" : (k === "R" || k === "r" ? "b" : "t") // lit return face
          if ((sunRight ? x < L + 3 : x > R - 3) && d > 6) k = "R"                                   // far edge turns away
        } else {
          var t = (x - L) / Math.max(1, R - L)
          // Terminator curves towards the far side as the skirt flattens (flatter ground faces up
          // more and catches more of the low sun).
          var term = 0.52 - 0.22 * skirt(y)
          var lit = sunRight ? t > term : t < 1 - term
          k = lit ? "r" : "R"
          if (lit && (sunRight ? t > 0.8 - 0.1 * skirt(y) : t < 0.2 + 0.1 * skirt(y))) k = "b" // facing the sun squarely
          if (y < MESA.bench + 2) k = "B"                    // shadow under the cliff foot
          else {
            // rills: fall lines at fixed shares of the width, broken into 4–9 px segments
            var u = t * RILLS, i = Math.round(u)
            if (Math.abs(u - i) * (R - L) / RILLS < 0.6 && hash2(51, i, (y + i * 3) >> 3) > 0.35)
              k = lit ? (k === "b" ? "r" : "R") : "B"
          }
        }
        c.px(x, y, k)
      }
    }
    // Cracks down the cliff: zig-zag in 2-px runs, lit wall on the sun's side, shadow wall opposite.
    MESA.cracks.forEach(function (ck, i) {
      var x = ck[0], y0 = mesaTop(ck[0]) + 7, y1 = Math.round(y0 + (MESA.bench - y0) * ck[1])
      for (var y = y0; y < y1; y++) {
        if (y % 6 === 0 && hash2(41, i, y) > 0.5) x += hash2(42, i, y) > 0.5 ? 1 : -1
        c.px(x + (sunRight ? 1 : -1), y, "b"); c.px(x, y, "B"); c.px(x - (sunRight ? 1 : -1), y, "R")
      }
    })
    // Boulders near the foot of the skirt: lit top on the sun's side, dark base.
    for (var i = 0; i < 16; i++) {
      var by = MESA.base - 22 + Math.round(hash2(9, i, 1) * 20)
      var bx = Math.round(mesaLeft(by) + hash2(9, i, 0) * (mesaRight(by) - mesaLeft(by)))
      if (!c.is(bx, by, "rRb") || !c.is(bx + 3, by + 2, "rRb")) continue
      c.rect(bx, by, 4, 2, "r"); c.rect(bx + (sunRight ? 3 : 0), by, 1, 1, "t"); c.rect(bx, by + 2, 4, 1, "B")
    }
  }

  /** Fault offset: strata drop a pixel between alternate cracks. */
  function faultAt(x) {
    var n = 0
    MESA.cracks.forEach(function (k) { if (x > k[0]) n++ })
    return n % 2 === 1
  }

  // ---------------------------------------------------------------- dunes

  /**
   * Dune profile: asymmetric smooth humps (gentle windward side, steeper slip face), plus a little
   * fBm. Returns the profile and, per column, which hump owns it.
   */
  function duneLayer(seed, humps, base) {
    var owner = new Array(W)
    var P = ridgeProfile(W, { y: 0, amp: 3, scale: 40, seed: seed, octaves: 2, shape: function (x) {
      var best = base, bi = -1
      humps.forEach(function (h, i) {
        var dx = x - h.x, w = dx < 0 ? h.wl : h.wr
        var v = h.y + (base - h.y) * (1 - Math.exp(-(dx / w) * (dx / w)))
        if (v < best) { best = v; bi = i }
      })
      owner[x] = bi
      return best
    } })
    return { P: P, owner: owner, humps: humps, base: base }
  }

  /**
   * Crest line of a hump: from its top, curving down and away from the sun. Faces on the sun's side
   * of it are lit; the split is exact (hard edge), the classic sharp dune crest.
   */
  function crestX(h, P, d) {
    var away = h.dir || (h.x < SUN.x ? -1 : 1) // h.dir aims the crest (leading lines)
    // Sweeps out away from the sun, then curls back under: an arc, not a straight fold.
    return h.x + away * (h.c1 * h.len * Math.sin(Math.min(1, d / h.len) * Math.PI * 0.85)) - away * h.c2 * d
  }

  /**
   * The mesa's long evening shadow on the ground. The sun is low and behind the mesa, so the shadow
   * runs from the mesa's foot away from it: down and to the left on screen, as a band as wide as the
   * cliff, widening as it comes nearer. Each pixel is traced back along that direction to the mesa's
   * foot line; the higher a pixel sits on its dune (above the layer's base), the further it is
   * pushed along, so the shadow's edges bend over the crests it crosses. Hard edge.
   */
  var MESA_SHADOW = { foot: 430, x0: 72, x1: 158, len: 104 }
  var SHADOW_DIR = (function () {
    var dx = (MESA.x0 + MESA.x1) / 2 - SUN.x, dy = MESA_SHADOW.foot - SUN.y, l = Math.hypot(dx, dy)
    return [dx / l, dy / l]
  })()
  var SHADOW_OF = { g: "S", a: "S", s: "S", S: "A", A: "A" }
  function inMesaShadow(x, y, D) {
    var lift = Math.max(0, D.base - y) * 0.7 // terrain height on this dune
    var yy = y + lift
    var t = (yy - MESA_SHADOW.foot) / SHADOW_DIR[1]
    if (t < 0 || t > MESA_SHADOW.len) return false
    var bx = x - t * SHADOW_DIR[0], grow = t * 0.12
    return bx >= MESA_SHADOW.x0 - grow && bx <= MESA_SHADOW.x1 + grow
  }

  /**
   * Draw a dune layer. o: { D, lit, shade, rim, ripple?: { lit, shade, gapLit, gapShade } }.
   * Ripples: thin lines following the dune's top profile, every gapShade rows in shadow and every
   * gapLit rows (and broken) on the lit side.
   */
  function drawDune(c, o) {
    var D = o.D
    for (var x = 0; x < W; x++) {
      var top = D.P[x], hi = D.owner[x], h = D.humps[hi]
      for (var y = top; y < H; y++) {
        var lit
        if (!h) lit = false
        else {
          var hTop = D.P[Math.max(0, Math.min(W - 1, Math.round(h.x)))]
          var cx = crestX(h, D.P, Math.max(0, y - hTop))
          // The sun's side of each hump is fixed by where the hump stands, so the split never flips
          // when the crest curls back.
          lit = SUN.x > h.x ? x >= cx : x < cx
        }
        var k = lit ? o.lit : o.shade
        if (y === top && lit) k = o.rim // lit lip of the silhouette
        if (h && lit && Math.abs(x - crestX(h, D.P, Math.max(0, y - D.P[Math.round(h.x)]))) < 1 && y - top < 60) k = o.rim // crest glint
        if (o.ripple && y > top + 2) {
          var r = y - top - Math.round(2 * Math.sin(x / 19 + y / 37))
          if (!lit && r % o.ripple.gapShade === 0) k = o.ripple.shade
          // Lit side: only a few long wind ripples at set depths, fading out towards their ends.
          if (lit && o.ripple.long && o.ripple.long.indexOf(r) >= 0 && fbm1((o.seed || 5) + r, x / 40) > 0.38) k = o.ripple.lit
        }
        if (inMesaShadow(x, y, D)) k = SHADOW_OF[k] || k
        c.px(x, y, k)
      }
    }
  }

  // Humps: x, y (top), wl/wr (half-widths of the windward / slip sides), crest arc: len (rows),
  // c1 (how far it sweeps out per row of len), c2 (lean back per row).
  var D1 = duneLayer(11, [{ x: 300, y: 388, wl: 90, wr: 70, len: 30, c1: 0.5, c2: 0.2 }, { x: 0, y: 406, wl: 40, wr: 90, len: 20, c1: 0.5, c2: 0.2 }], 426)
  var D2 = duneLayer(12, [{ x: 338, y: 414, wl: 120, wr: 60, len: 40, c1: 0.6, c2: 0.2 }, { x: 14, y: 434, wl: 60, wr: 90, len: 30, c1: 0.6, c2: 0.2 }], 462)
  // D3 and D4 crests start near the mesa's side of the frame and sweep down and outwards, so
  // read upwards they point at the mesa's foot (as do the dips of D1 and D2).
  var D3 = duneLayer(13, [{ x: 150, y: 448, wl: 120, wr: 110, len: 60, c1: 0.9, c2: 0.1, dir: -1 }, { x: 340, y: 462, wl: 110, wr: 60, len: 40, c1: 0.6, c2: 0.2 }], 496)
  var D4 = duneLayer(14, [{ x: 92, y: 488, wl: 150, wr: 260, len: 150, c1: 0.7, c2: 0.25, dir: 1 }], 532)

  // ---------------------------------------------------------------- foreground pebbles

  /**
   * Sparse pebbles: rounded tops lit on the sun's side, a dark base, and a long flat shadow lying on
   * the ground away from the sun (the sun is low, so shadows run ~3× the pebble's width).
   */
  function pebbles(c) {
    function pebble(x, y, w) {
      var h = Math.max(3, Math.round(w * 0.6)), away = SUN.x > x ? -1 : 1, len = Math.round(w * 1.6)
      c.rect(away < 0 ? x - len : x + w, y + h - 1, len, 1, "B")
      for (var yy = 0; yy < h; yy++) {
        var inset = yy === 0 ? Math.max(1, Math.round(w / 6)) : 0 // rounded top corners
        for (var xx = inset; xx < w - inset; xx++) {
          var sunSide = away < 0 ? xx >= w / 2 : xx < w / 2
          c.px(x + xx, y + yy, yy === h - 1 ? "B" : yy === 0 && sunSide ? "b" : sunSide ? "r" : "R")
        }
      }
    }
    for (var i = 0; i < 16; i++) {
      var x = Math.round(20 + hash2(31, i, 0) * (W - 40)), y = Math.round(504 + Math.sqrt(hash2(31, i, 1)) * 126)
      // In deep shadow a pebble's shadow disappears: leave those out.
      if (c.is(x, y, "AB") || c.is(x + 4, y + 3, "AB")) continue
      var g = (y - 480) / 160
      pebble(x, y, 5 + Math.round(g * 7 + hash2(31, i, 2) * 3))
    }
    // A small rock cluster near the bottom-right corner (on lit sand, so the shadows read):
    // two bigger rocks and a smaller one, back first.
    pebble(300, 586, 14); pebble(284, 596, 18); pebble(316, 602, 9)
  }

  // ---------------------------------------------------------------- scene

  /** Mesa, dunes and pebbles: drawn once per time as a part and stamped (nothing in it moves). */
  function landItems() {
    return [
      heroMesa,
      function (c) {
        drawDune(c, { D: D1, lit: "g", shade: "a", rim: "g" })
        drawDune(c, { D: D2, lit: "a", shade: "s", rim: "g" })
        drawDune(c, { D: D3, lit: "a", shade: "S", rim: "g", seed: 3, ripple: { lit: "s", shade: "A", gapShade: 4 } })
        drawDune(c, { D: D4, lit: "S", shade: "A", rim: "s", seed: 4, ripple: { lit: "s", shade: "B", gapShade: 5, long: [22, 40, 62, 90] } })
      },
      pebbles,
    ]
  }

  /**
   * Sand grains blowing off the lit crest of D3 (dusk loop): five 2×1 grains, each lifts off the crest top and drifts
   * downwind over the slip face, fading out (bright → sand → gone). Each grain runs once per loop at
   * its own offset; it starts on the crest's own rim colour, so it appears without a pop.
   */
  function crestGrains(c) {
    for (var i = 0; i < 5; i++) {
      var u = ((c.phase || 0) + i / 5) % 1
      if (u > 0.8) continue
      var x0 = 148 + i * 4, y0 = D3.P[x0] - 1
      var x = Math.round(x0 - 26 * u), y = Math.round(y0 - 3 * Math.sin(Math.PI * u) + 4 * u * u)
      c.rect(x, y, 2, 1, u < 0.35 ? "g" : u < 0.6 ? "a" : "s") // 2×1: reads at phone size
    }
  }

  // Loop motion (anims only): dusk clouds sway 1 px; night stars twinkle above the mesa's top.
  var SKY_MOTION = { dusk: { clouds: 1 }, night: { twinkle: { n: 7, maxY: 280 } } }

  /**
   * The study for one time of day: palette swap + skyLayer(time); everything else is the same
   * drawing (night = pure palette swap, lit from the dusk sun's side where the moon now stands).
   */
  function desertScene(time, o) {
    o = o || {}
    var P = nightOrPalette(time, o.accent || "silver", "night"), N = o.name || "desert_" + time
    var sky = landSky(P, o), stage = landStage(o, time === "night")
    scene("_desert_land_" + time, { w: W, h: H }, ...landItems())
    scene(N, { w: W, h: H, bg: "U" },
      ...sky(SKY_OPTS[time]),
      farMesas,
      farPlain,
      ...stage("back", false),
      stamp("_desert_land_" + time, 0, 0),
      ...P.end, ...stage("front", false),
    )
    // Seamless loop: 24 frames at 12 fps (2 s). Mesa, dunes and foreground are the stamped part.
    anim(N + "_loop", { w: W, h: H, frames: 24, fps: 12 },
      ...sky(Object.assign({}, SKY_OPTS[time], { motion: SKY_MOTION[time] })),
      farMesas,
      function (c) { farPlain(c, time === "dusk" ? c.phase : undefined) },
      ...stage("back", true),
      function (c) { c.stamp("_desert_land_" + time, 0, 0) },
      function (c) { if (time === "dusk") crestGrains(c) },
      ...P.end, ...stage("front", true))
  }

  return { define: desertScene, geo: { horizon: HORIZON, water: null, ground: 560, frames: 24, accent: "silver", legacy: "night", sky: SKY_OPTS.night } }
}
