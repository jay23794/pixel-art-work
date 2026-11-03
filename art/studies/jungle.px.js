// jungle — looking into a deep jungle: jungle_dusk, jungle_night (pure palette swap +
// skyLayer("night"), the moon behind the same canopy gap).
//
// Light: the low dusk sun behind a gap in the canopy, upper right (SUN). Its light comes down
// through the gap as stepped shafts onto one clearing (the focal point); leaf clusters and trunks
// are lit on the side facing it.
//
// Depth, back to front: sky in the gap → far masses (pale, foggy, no detail) → mid-far masses
// (blue-grey silhouettes) → fog bands → mid trees (green clusters, trunks) → clearing and ground →
// light shafts → near frame (dark canopy with the gap, big trunks, vines, ferns, litter).
include("../palettes.px.js")
include("../lib/noise.px.js")
include("../lib/sky.px.js")

var W = 360, H = 640
// The sun stands in the canopy gap; clouds are pushed off-canvas (the canopy hides the sky).
var SKY = { sun: { x: 268, y: 150 }, clouds: { x: -400, stratus: { hide: [0, 1, 2] } } }
var SUN = skyLight("dusk", SKY)
// Night: the moon behind the same canopy gap, so the shafts become moonlight (palette swap).
var SKY_OPTS = { dusk: SKY, night: { moon: { x: SUN.x, y: SUN.y }, clouds: { x: -400, stratus: { hide: [0] } } } }
// Loop motion: stills use STILL; anim items build a state from c.phase (all offsets are sins of the
// loop phase, so frame 23 flows into frame 0).
var STILL = { on: false, p: 0 }
function motion(c) { return { on: true, p: c.phase || 0 } }
var GAP = { x: 262, y: 140, rx: 62, ry: 56 }       // opening in the near canopy
var CLEARING = { x: 162, y: 446, rx: 52, ry: 14 }  // where the shafts land

// ---------------------------------------------------------------- leaf parts
// Clusters lit from the right (the sun's side for most of the frame); flipped where the sun is on
// their left. Keys: H shadow, J dark leaf, j mid leaf, a sunlit edge. Parts keep the palette that
// is active where they are defined, so they are defined per time, after palette(time).
function defineParts(time) {
  var t = "_" + time
  sprite("_leafA" + t, `
    ...jjj...
    ..jjjaa..
    .JJjjjaa.
    JJJjjjja.
    HJJJjjj..
    .HJJJj...
    ..HH.....`)
  sprite("_leafB" + t, `
    .jja.
    jjjaa
    JJjja
    HJJj.
    .HH..`)
  sprite("_leafC" + t, `
    ..jj..
    .Jjja.
    JJjjja
    HJJjj.
    .HJJ..`)
  group("leaves" + t, ["_leafA" + t, "_leafA" + t, "_leafB" + t, "_leafC" + t])
  // Litter on the forest floor: tiny fallen leaves.
  sprite("_litterA" + t, `
    Sj
    .S`)
  sprite("_litterB" + t, `
    .S.
    SAS`)
  group("litter" + t, ["_litterA" + t, "_litterB" + t])
}

// Per-layer colour swaps for the leaf parts: further back = paler, cooler, flatter.
var SWAP_FAR = { H: "h", J: "h", j: "z", a: "z" }
var SWAP_MIDFAR = { H: "F", J: "F", j: "f", a: "h" }
var SWAP_NEAR = { H: "H", J: "H", j: "J", a: "j" } // near frame: darkest, backlit, lit edges mid-green
// mid: the parts as drawn (H J j a): readable clusters, sunlit edges

// ---------------------------------------------------------------- masses

/**
 * Foliage wall: per column a bumpy top (overlapping crowns) and a bumpy underside, filled with one
 * key. Leaf clusters scattered on it give the texture and break the silhouette.
 */
function wall(c, o) {
  for (var x = 0; x < W; x++) {
    var top = Infinity, bot = -Infinity
    o.crowns.forEach(function (b) {
      var dx = x - b[0]
      if (Math.abs(dx) >= b[2]) return
      var h = Math.sqrt(b[2] * b[2] - dx * dx)
      top = Math.min(top, b[1] - h)
      bot = Math.max(bot, b[1] + h * (o.under || 0.6))
    })
    if (top === Infinity) continue
    for (var y = Math.round(top); y <= Math.round(Math.min(o.floor || bot, H - 1)); y++) c.px(x, y, o.key)
  }
}

/** Trunk with bark shading: lit edge on the sun's side, shadow side, bark streaks, knots, roots. */
function trunk(c, o) {
  var sunRight = SUN.x > o.x
  for (var y = o.y0; y < o.y1; y++) {
    var flare = Math.max(0, y - (o.y1 - 26)) // roots flare out near the base
    var hw = o.w / 2 + Math.pow(flare / 26, 2) * o.w * 0.9 + Math.round(Math.sin(y / 23 + o.x) * 1)
    for (var x = Math.round(o.x - hw); x <= Math.round(o.x + hw); x++) {
      var u = (x - (o.x - hw)) / (2 * hw), s = sunRight ? u : 1 - u // 1 = sun side
      var k = s > 0.78 ? o.keys[3] : s > 0.5 ? o.keys[2] : s > 0.12 ? o.keys[1] : o.keys[0]
      // bark streaks: broken vertical grooves
      var col = Math.round(u * o.w)
      if (col % 4 === 1 && hash2(o.seed, col, y >> 3) > 0.45 && s < 0.9) k = o.keys[Math.max(0, o.keys.indexOf(k) - 1)]
      c.px(x, y, k)
    }
  }
  // knots: a dark hollow with a lit lip on the sun's side
  ;(o.knots || []).forEach(function (kn) {
    c.ellipse(o.x + kn[0], kn[1], 2, 3, o.keys[0])
    c.px(o.x + kn[0] + (sunRight ? 2 : -2), kn[1] + 2, o.keys[3])
  })
}

// ---------------------------------------------------------------- layers

// Crowns: [x, y, r]. Walls overlap into continuous canopy; the gap stays open around the sun.
var FAR_CROWNS = [[0, 156, 26], [36, 146, 24], [74, 158, 26], [112, 148, 24], [150, 160, 24], [188, 170, 22],
  [222, 190, 18], [252, 202, 16], [270, 204, 14], [290, 196, 18], [326, 176, 24], [362, 168, 24]]
// Second, slightly darker row of far crowns in front of the far wall.
var FAR2_CROWNS = [[10, 226, 22], [52, 214, 20], [96, 228, 22], [140, 218, 20], [178, 232, 18], [300, 232, 18], [340, 222, 22]]
var SWAP_FAR2 = { H: "f", J: "f", j: "h", a: "h" }
var MIDFAR_CROWNS = [[-8, 186, 34], [42, 172, 30], [88, 192, 26], [124, 180, 24], [168, 200, 22], [330, 190, 30], [372, 176, 32]]
// Low bushes along the far floor: uneven heights and spacing.
var UNDER_CROWNS = (function () {
  var out = [], x = -6
  while (x < W + 10) { var r = 6 + Math.round(hash2(97, x, 0) * 8); out.push([x, 432 - Math.round(hash2(97, x, 1) * 6), r]); x += r + Math.round(hash2(97, x, 2) * 14) }
  return out
})()
// Mid crowns on the left reach up into the near canopy (no sky left of the gap).
var MID_LEFT = [[-14, 130, 46], [30, 104, 40], [80, 120, 36], [118, 150, 30], [56, 170, 34], [10, 196, 34], [150, 188, 22],
  [140, 116, 32], [182, 136, 28], [200, 172, 18], [110, 92, 30]]
var MID_RIGHT = [[318, 186, 34], [356, 150, 44], [372, 210, 34], [294, 222, 22]]

function farLayer(c) {
  wall(c, { crowns: FAR_CROWNS, key: "h", floor: 436 }) // a solid wall of distant forest
  ;[[20, 1], [92, 2], [160, 1], [312, 2], [344, 1]].forEach(function (t) { c.rect(t[0], 220, t[1], 210, "f") })
}

function far2Layer(c) {
  wall(c, { crowns: FAR2_CROWNS, key: "f", floor: 436 })
  ;[[26, 2], [118, 2], [196, 1], [318, 2]].forEach(function (t) { c.rect(t[0], 236, t[1], 200, "F") }) // faint trunks
}

function midFarLayer(c) {
  wall(c, { crowns: MIDFAR_CROWNS, key: "F", under: 1.2 })
  ;[[30, 4], [110, 3], [174, 3], [338, 5]].forEach(function (t) { c.rect(t[0] - (t[1] >> 1), 200, t[1], 232, "F") })
}

/**
 * Fog: stepped bands rising off the ground between the layers. Each band recolours what's behind
 * it (far and mid-far masses, trunks, the sky) to a fog key: palest low down and further back.
 */
function fog(c, m) {
  m = m || STILL
  var shift = m.on ? Math.round(1.5 * Math.sin(2 * Math.PI * m.p)) : 0 // bands drift sideways ±1–2 px
  for (var y = 250; y < 440; y++)
    for (var x = 0; x < W; x++) {
      var wave = Math.round(3 * Math.sin((x - shift) / 29 + y / 50))
      if (y + wave > 404 && c.is(x, y, "hfF")) c.px(x, y, "z")
      else if (y + wave > 364 && c.is(x, y, "fF")) c.px(x, y, "h")
      else if (y + wave > 318 && c.is(x, y, "F")) c.px(x, y, "f")
    }
}

function midLayer(c) {
  trunk(c, { x: 62, y0: 160, y1: 450, w: 14, seed: 3, keys: ["B", "R", "R", "r"], knots: [[2, 300]] })
  trunk(c, { x: 128, y0: 180, y1: 446, w: 8, seed: 5, keys: ["B", "R", "R", "r"] })
  trunk(c, { x: 318, y0: 190, y1: 444, w: 12, seed: 4, keys: ["B", "R", "R", "r"], knots: [[-1, 330]] })
  wall(c, { crowns: MID_LEFT, key: "J", under: 0.5 })
  wall(c, { crowns: MID_RIGHT, key: "J", under: 0.5 })
}

/**
 * Ground: misty far floor, undergrowth along it, the clearing (lit by the shafts), the darker mid
 * floor with roots, and the dark near floor.
 */
function ground(c) {
  for (var y = 424; y < H; y++)
    for (var x = 0; x < W; x++) {
      var dx = (x - CLEARING.x) / CLEARING.rx, dy = (y - CLEARING.y) / CLEARING.ry, d = dx * dx + dy * dy
      // the floor is dark except a ring of bounce light around the clearing
      var k = y < 434 ? "f" : y < 492 ? "A" : "B"
      if (d < 2.6 && y >= 434) k = "S"
      if (d < 1) k = "s"
      c.px(x, y, k)
    }
  // Roots: from the mid trunks' feet across the floor; a lit top edge, brightest in the clearing.
  ROOTS.forEach(function (r) {
    for (var i = 0; i + 3 < r.length; i += 2) c.line(r[i], r[i + 1], r[i + 2], r[i + 3], "R", 2)
  })
  for (var y = 440; y < 520; y++)
    for (var x = 0; x < W; x++) {
      if (!c.is(x, y, "R") || c.is(x, y - 1, "R")) continue
      var dx = (x - CLEARING.x) / CLEARING.rx, dy = (y - CLEARING.y) / CLEARING.ry
      c.px(x, y - 1, dx * dx + dy * dy < 2.6 ? "b" : "r")
      if (!c.is(x, y + 2, "R")) c.px(x, y + 2, "B")
    }
}
var ROOTS = [
  [62, 452, 84, 462, 110, 468, 134, 470],
  [318, 446, 296, 456, 262, 462, 226, 470, 204, 476],
  [128, 448, 140, 458, 150, 474, 146, 492],
]

/**
 * Light shafts: three diagonal bands from the gap down to the clearing. Inside each, colours step
 * up their ramps: two steps in the core, one at the edges (stepped, no blur). They light the
 * clearing, the fog and the edges of the mid leaves they pass.
 */
var SHAFTS = [[-24, 7], [0, 11], [22, 6]] // perpendicular offset, half-width
function shaftAt(x, y, m) {
  var dx = CLEARING.x - SUN.x, dy = CLEARING.y - SUN.y, l = Math.hypot(dx, dy)
  var ux = dx / l, uy = dy / l
  var t = (x - SUN.x) * ux + (y - SUN.y) * uy, p = (x - SUN.x) * -uy + (y - SUN.y) * ux
  if (t < SUN.r + 30 || t > l + 12) return 0 // start below the sun's disk and halo
  for (var i = 0; i < SHAFTS.length; i++) {
    var hw = SHAFTS[i][1] * (0.7 + 0.5 * t / l) // widening slightly as they fall
    if (m && m.on) hw += Math.sin(2 * Math.PI * (m.p + i / 3)) > 0 ? 1 : 0 // edges shimmer 1 px
    var off = Math.abs(p - SHAFTS[i][0] * (0.6 + 0.6 * t / l))
    if (off < hw * 0.45) return 2
    if (off < hw) return 1
  }
  return 0
}
function shafts(c, m) {
  c.light(function (x, y) { return shaftAt(x, y, m) === 2 }, 2)
  c.light(function (x, y) { return shaftAt(x, y, m) === 1 }, 1)
}

/**
 * Dust motes (dusk loop): a few pale specks drifting slowly down the shafts. Each runs once per
 * loop at its own offset and only shows inside a shaft, away from the start and end of its run.
 */
function motes(c, m) {
  var dx = CLEARING.x - SUN.x, dy = CLEARING.y - SUN.y, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l
  for (var i = 0; i < 7; i++) {
    var u = (m.p + i / 7) % 1
    if (u < 0.1 || u > 0.9) continue
    var t = 90 + hash2(95, i, 0) * 150 + 36 * u, off = (hash2(95, i, 1) - 0.5) * 50
    var x = Math.round(SUN.x + ux * t - uy * off + 3 * Math.sin(2 * Math.PI * (u + i))), y = Math.round(SUN.y + uy * t + ux * off)
    if (!shaftAt(x, y)) continue
    c.rect(x, y, i % 3 === 0 ? 2 : 1, 1, "m")
  }
}

/**
 * Fireflies (night loop): small warm glowing dots on smooth looping paths (Lissajous, 1:2) around
 * the clearing and the mid layer, blinking at their own phases. Each is a stepped glow: a warm
 * yellow core (O), an amber ring (N) — both from the jungle_night palette variant — and an outer
 * ring of neighbours one ramp step lighter (in palette, no blur).
 */
var FIREFLIES = (function () {
  var out = []
  for (var i = 0; i < 10; i++) {
    var near = i < 5
    out.push({
      cx: near ? 112 + hash2(96, i, 0) * 104 : 80 + hash2(96, i, 0) * 210,
      cy: near ? 400 + hash2(96, i, 1) * 56 : 286 + hash2(96, i, 1) * 100,
      ax: 8 + hash2(96, i, 2) * 12, ay: 4 + hash2(96, i, 3) * 6, o1: hash2(96, i, 4), o2: hash2(96, i, 5), ob: i / 10,
    })
  }
  return out
})()
function fireflies(c, m) {
  FIREFLIES.forEach(function (f) {
    if (Math.sin(2 * Math.PI * (m.p + f.ob)) < -0.25) return // blinking off
    var x = Math.round(f.cx + f.ax * Math.sin(2 * Math.PI * (m.p + f.o1))), y = Math.round(f.cy + f.ay * Math.sin(2 * Math.PI * (2 * m.p + f.o2)))
    c.light([x, y, 2.6], 1)
    c.px(x - 1, y, "N"); c.px(x + 1, y, "N"); c.px(x, y - 1, "N"); c.px(x, y + 1, "N")
    c.px(x, y, "O")
  })
}

/** Near canopy: a dense mass along the top with the gap cut out (texture from near clusters). */
function nearCanopy(c) {
  for (var y = 0; y < 190; y++)
    for (var x = 0; x < W; x++) {
      var gx = (x - GAP.x) / GAP.rx, gy = (y - GAP.y) / GAP.ry
      var edge = 70 + Math.round(22 * Math.sin(x / 31 + 1) + 12 * Math.sin(x / 11))
      // left of the gap the canopy comes down to meet the mid crowns: no sky there
      if (x < 206) edge = Math.max(edge, 104 + Math.round(8 * Math.sin(x / 13) + 5 * Math.sin(x / 5.3)))
      if (gx * gx + gy * gy < 1) continue
      if (y < edge) c.px(x, y, "H")
    }
}

/** Big near trunks framing left and right. */
function nearTrunks(c) {
  trunk(c, { x: 14, y0: 0, y1: 520, w: 30, seed: 7, keys: ["B", "R", "r", "b"], knots: [[4, 260], [-2, 380]] })
  trunk(c, { x: 344, y0: 0, y1: 512, w: 26, seed: 8, keys: ["B", "R", "r", "b"], knots: [[-3, 330]] })
}

/** Vines from the top: wavering lines with small leaves, lit on the sun's side. */
var VINES = [[58, 230], [104, 170], [196, 132], [222, 250], [304, 210]]
// Built per time (items run at build time, after every definition, so they must capture the time
// whose leaf part they stamp rather than read a global).
function vinesFor(time, animate) { return function (c) { vines(c, time, animate ? motion(c) : STILL) } }
function vines(c, time, m) {
  m = m || STILL
  VINES.forEach(function (v, vi) {
    var sway = m.on ? 2 * Math.sin(2 * Math.PI * m.p + vi * 1.3) : 0 // pinned at the top, swinging below
    for (var y = 0; y < v[1]; y++) {
      var x = Math.round(v[0] + 3 * Math.sin(y / 17 + vi) + 1.5 * Math.sin(y / 6 + vi * 2) + sway * y / v[1])
      c.px(x, y, "H"); c.px(x + (SUN.x > x ? 1 : -1), y, "J")
      if (y % 13 === 6) c.stamp("_leafB_" + time, x - (y % 26 < 13 ? 5 : 0), y - 2, y % 26 < 13 ? { flip: "x" } : {})
    }
  })
}

/**
 * Fern frond: a curved rib with solid leaflets (2–3 px strokes), upper leaflets lighter with a lit
 * tip on the sun's side, lower ones in shadow. keys: { rib, up, low, tip }.
 */
function frond(c, x0, y0, len, dir, lift, keys, width) {
  keys = keys || { rib: "H", up: "J", low: "H", tip: "j" }
  for (var i = 0; i <= len; i++) {
    var t = i / len
    var x = Math.round(x0 + dir * i), y = Math.round(y0 - lift * Math.sin(Math.PI * t * 0.75) + t * t * 26)
    c.rect(x, y, 2, 2, keys.rib)
    if (i % 6 !== 0 || i === 0) continue
    var leaf = Math.round((1 - t) * 12) + 4
    var ux = x + dir * Math.round(leaf * 0.55), uy = y - leaf, lx = x + dir * Math.round(leaf * 0.5), ly = y + Math.round(leaf * 0.7)
    c.line(x, y, lx, ly, keys.low, width || 3)
    c.line(x, y, ux, uy, keys.up, width || 3)
    if (SUN.x > x === dir > 0 || true) c.rect(ux - 1, uy - 1, 2, 1, keys.tip) // lit tip
  }
}

/**
 * Broad leaf (optionally split, like a monstera): pointed ellipse, upper half lighter, dark midrib,
 * a lit edge on the sun's side. keys: { up, low, rib, edge }; splits: number of slits per side.
 */
function bigLeaf(c, cx, cy, rx, ry, ang, keys, splits) {
  keys = keys || { up: "J", low: "H", rib: "B", edge: "j" }
  var ca = Math.cos(ang), sa = Math.sin(ang), sunSide = SUN.x > cx ? 1 : -1
  for (var y = cy - rx; y <= cy + rx; y++)
    for (var x = cx - rx; x <= cx + rx; x++) {
      var u = ((x - cx) * ca + (y - cy) * sa) / rx, v = (-(x - cx) * sa + (y - cy) * ca) / ry
      var w = 1 - u * u // pointed ends
      if (Math.abs(u) > 1 || Math.abs(v) > w) continue
      // slits: thin gaps from the edge towards the rib
      if (splits && Math.abs(v) > 0.25 && Math.abs(((u + 1) * splits * 1.5) % 1.5 - 0.75) < 0.12) continue
      var k = v < 0 ? keys.up : keys.low
      if (Math.abs(v) < 0.1) k = keys.rib
      if (Math.abs(v) > w - 0.14 && (x - cx) * sunSide > -rx * 0.3 && v < 0.3) k = keys.edge
      c.px(x, y, k)
    }
}

/** Foreground framing the bottom corners: varied leaves (broad, split, small) and ferns. */
function foreground(c) {
  frond(c, -4, 556, 76, 1, 38)
  frond(c, 364, 570, 80, -1, 40)
  bigLeaf(c, 44, 574, 50, 18, -0.75, null, 3)   // big split leaf
  bigLeaf(c, 18, 612, 40, 13, -0.15)            // broad
  bigLeaf(c, 82, 624, 30, 10, 0.3)              // small broad
  bigLeaf(c, 26, 638, 46, 15, 0.55, null, 2)    // split, low
  bigLeaf(c, 322, 588, 52, 18, 0.7 + Math.PI, null, 3)
  bigLeaf(c, 290, 618, 36, 12, 0.2 + Math.PI)
  bigLeaf(c, 344, 632, 44, 14, -0.3 + Math.PI)
}

/** Mid-scale plants among the mid crowns: broad leaves and a palm frond, so crowns read as plants. */
var MID_KEYS = { up: "j", low: "J", rib: "H", edge: "a" }
function midPlants(c) {
  bigLeaf(c, 160, 198, 24, 9, -0.35, MID_KEYS)
  bigLeaf(c, 140, 222, 20, 8, 0.55, MID_KEYS, 2)
  bigLeaf(c, 104, 180, 18, 7, -0.9, MID_KEYS)
  frond(c, 300, 226, 48, -1, 26, { rib: "J", up: "j", low: "J", tip: "a" }, 2) // palm frond reaching into the light
  frond(c, 300, 232, 36, -1, 6, { rib: "J", up: "j", low: "H", tip: "a" }, 2)
}

// ---------------------------------------------------------------- scene


/**
 * The static pieces of the scene as parts (built once, stamped): far wall, second far row,
 * mid-far, undergrowth, ground, mid trees, near frame. Fog, shafts and vines go between them.
 */
function defineLayers(time) {
  var L = "leaves_" + time, t = "_" + time
  scene("_far" + t, { w: W, h: H }, farLayer, scatter(L, 0, 120, W, 90, 260, { on: "h", rflip: "x", swap: SWAP_FAR }))
  scene("_far2" + t, { w: W, h: H }, far2Layer, scatter(L, 0, 186, W, 50, 160, { on: "f", rflip: "x", swap: SWAP_FAR2 }))
  scene("_midfar" + t, { w: W, h: H }, midFarLayer,
    scatter(L, 0, 140, SUN.x, 90, 260, { on: "F", swap: SWAP_MIDFAR }),
    scatter(L, SUN.x, 140, W - SUN.x, 90, 120, { on: "F", flip: "x", swap: SWAP_MIDFAR }))
  scene("_ground" + t, { w: W, h: H }, ground, scatter("litter" + t, 0, 520, W, 120, 110, { on: "B" }))
  scene("_under" + t, { w: W, h: H }, function (c) { wall(c, { crowns: UNDER_CROWNS, key: "f", floor: 438 }) },
    scatter(L, 0, 404, W, 30, 90, { on: "f", swap: SWAP_MIDFAR, rflip: "x" }))
  scene("_mid" + t, { w: W, h: H }, midLayer,
    scatter(L, 0, 50, SUN.x, 210, 900, { on: "J" }),
    scatter(L, SUN.x, 60, W - SUN.x, 200, 260, { on: "J", flip: "x" }),
    midPlants)
  scene("_near" + t, { w: W, h: H }, nearCanopy, nearTrunks,
    scatter(L, 0, 0, SUN.x, 150, 800, { on: "H", swap: SWAP_NEAR }),
    scatter(L, SUN.x, 0, W - SUN.x, 150, 260, { on: "H", flip: "x", swap: SWAP_NEAR }),
    foreground)
}

function jungleScene(time) {
  // Night uses its own variant: the night palette plus two warm firefly slots (see palettes.px.js).
  palette(time === "night" ? "jungle_night" : time)
  defineParts(time)
  defineLayers(time)
  var t = "_" + time
  scene("jungle_" + time, { w: W, h: H, bg: "U" },
    ...skyLayer(time, SKY_OPTS[time]),
    stamp("_far" + t, 0, 0), stamp("_far2" + t, 0, 0), stamp("_midfar" + t, 0, 0),
    fog,
    stamp("_ground" + t, 0, 0), stamp("_under" + t, 0, 0), stamp("_mid" + t, 0, 0),
    shafts,
    stamp("_near" + t, 0, 0),
    vinesFor(time),
  )
  // Seamless loop: 24 frames at 12 fps (2 s). Fog drifts, shaft edges shimmer, vines sway; dusk:
  // dust motes in the shafts; night: fireflies (the main motion). Trunks, ground, canopy still.
  anim("jungle_" + time + "_loop", { w: W, h: H, frames: 24, fps: 12 },
    ...skyLayer(time, SKY_OPTS[time]),
    stamp("_far" + t, 0, 0), stamp("_far2" + t, 0, 0), stamp("_midfar" + t, 0, 0),
    function (c) { fog(c, motion(c)) },
    stamp("_ground" + t, 0, 0), stamp("_under" + t, 0, 0), stamp("_mid" + t, 0, 0),
    function (c) { shafts(c, motion(c)) },
    function (c) { if (time === "dusk") motes(c, motion(c)); else fireflies(c, motion(c)) },
    stamp("_near" + t, 0, 0),
    vinesFor(time, true))
}

jungleScene("dusk")
jungleScene("night")
