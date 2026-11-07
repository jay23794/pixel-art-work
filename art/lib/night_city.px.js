// A far city at night as light dots, for the night kit: streets along a shore, houses on the hills,
// roads winding up them, towers with window grids, shopfronts and quay lamps, thinning out from a
// downtown peak. Extracted from harbour_night (its values are the defaults).
//   var city = cityLights({ shore: 342, ridge: HILLS_NEAR })
//   scene(..., function (c) { city(c, null) })        // still
//   anim(...,  function (c) { city(c, c.phase) })     // loop: ~3% of lights burst (nightFlicker)
// city.lights holds { x, y, v } of every light drawn by the last call, for reflections().
// Captures nightKeys() when cityLights() is called, so call it after nightPalette().
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_lights.px.js")

/**
 * opts (defaults = harbour_night):
 *   w (360), shore (waterline y), ridge (array: hill top per x; lights stay 2 px below it)
 *   downtown: { x: 182, w: 56 }   density peak; lights thin out with distance from it
 *   streets: rows above the shore    [0, 2, 4, 7, 10, 13, 17, 21]
 *   houses: 70                      scattered dots on contour lines
 *   roads: [[x0, y0, x1, y1, v]]     lights every few px up the hills (y0 = shore - n)
 *   towers: [[x, w, top]]            dark shapes with a grid of lit window dots
 *   shops: [x0, x1]                  lit shopfronts along the tower bases
 *   quay: true                       a row of lamps on the waterline
 *   keys: { tower: "R", edge: "B" }  night keys for the towers (harbour: "U", "B")
 *   flicker: { rate, frames, seed }  see nightFlicker
 *   lower: { chain, rows }           two-hued accents (neon): the quay, shopfronts and street rows
 *                                    within `rows` px of the shore in this chain (cyan), the rest
 *                                    (towers, upper city) in the accent's chain (pink)
 * Every light in .lights carries its chain (ch) for reflections().
 */
function cityLights(opts) {
  var K = nightKeys(), chain = K.state.chain, o = opts || {}
  var W = o.w || 360, SHORE = o.shore, RIDGE = o.ridge
  var DT = o.downtown || { x: 182, w: 56 }
  var STREETS = o.streets || [0, 2, 4, 7, 10, 13, 17, 21]
  var HOUSES = o.houses !== undefined ? o.houses : 70
  var ROADS = o.roads || [[60, SHORE - 3, 26, 310, 0.5], [292, SHORE - 3, 330, 316, 0.6], [120, SHORE - 6, 104, 318, 0.4]]
  var TOWERS = o.towers || [[150, 8, 304], [160, 12, 294], [174, 7, 300], [183, 10, 288], [195, 8, 298], [205, 12, 306], [220, 6, 314]]
  var SHOPS = o.shops || [136, 236]
  var keys = o.keys || { tower: "R", edge: "B" }, FL = o.flicker || {}
  function density(x) { return 0.12 + 0.88 * Math.exp(-Math.pow((x - DT.x) / DT.w, 2)) }
  var LOW = o.lower || null
  function chainAt(y, kind) { return LOW && (kind === "low" || y >= SHORE - LOW.rows) ? LOW.chain : chain }
  function key(v, ch) { return nightLightKey(K, v, ch || chain) }
  // A dropped light (nightFlicker) shows a step dimmer.
  function flick(x, y, v, p) { return nightFlicker(x * 1000 + y, p, FL) ? v * 0.55 : v }

  function draw(c, p) {
    var LIGHTS = (draw.lights = [])
    function light(x, y, v, kind) {
      x = Math.round(x); y = Math.round(y)
      if (x < 0 || x >= W || y < RIDGE[x] + 2) return
      v = flick(x, y, v, p)
      var ch = chainAt(y, kind)
      c.px(x, y, key(v, ch))
      if (v > 0.85 && hash2(41, x, y) > 0.5) c.px(x + 1, y, key(v * 0.8, ch)) // a few 2-px lights
      LIGHTS.push({ x: x, y: y, v: v, ch: ch })
    }
    // Streets parallel to the shore.
    STREETS.forEach(function (up, si) {
      var y = SHORE - 2 - up
      for (var x = 0; x < W; x += 2 + Math.round(hash2(42, si, x) * 2)) {
        if (hash2(43, si, Math.floor(x / 14)) < 0.15) continue // dark blocks between streets
        if (hash2(44, si, x) < density(x) * (si === 0 ? 1.2 : 1.0 - si * 0.07)) light(x, y, Math.min(1, hash2(45, si, x) * (0.7 + 0.5 * density(x))))
      }
    })
    // Houses scattered along contour lines on the near hills, sparse.
    for (var i = 0; i < HOUSES; i++) {
      var x = Math.floor(hash2(49, i, 0) * W), up = 4 + Math.floor(hash2(49, i, 1) * 3) * 4
      light(x, Math.max(RIDGE[x] + 3, SHORE - 24 - up), 0.15 + 0.5 * hash2(49, i, 2))
    }
    // Roads winding up the hills, lights every few px.
    ROADS.forEach(function (r, ri) {
      for (var t = 0; t <= 1; t += 0.06) light(r[0] + (r[2] - r[0]) * t + 2 * Math.sin(t * 9), r[1] + (r[3] - r[1]) * t, r[4] * hash2(46, ri, t * 100))
    })
    // Towers: dark shapes, an edge on the side away from the moon, window dots.
    TOWERS.forEach(function (tw, ti) {
      c.rect(tw[0], tw[2], tw[1], SHORE - tw[2], K(keys.tower))
      c.rect(tw[0], tw[2], 1, SHORE - tw[2], K(keys.edge))
      for (var y = tw[2] + 2; y < SHORE - 3; y += 3)
        for (var x = tw[0] + 1; x < tw[0] + tw[1] - 1; x += 2)
          if (hash2(47, ti * 100 + x, y) < 0.32) { c.px(x, y, key(flick(x, y, 0.3 + 0.6 * hash2(48, x, y), p))); LIGHTS.push({ x: x, y: y, v: 0.5, ch: chain }) }
    })
    // Street level downtown: lit shopfronts along the tower bases and the blocks between them.
    for (var x = SHOPS[0]; x < SHOPS[1]; x++) {
      var dd = density(x)
      if (hash2(65, x, 0) < 0.75 * dd) light(x, SHORE - 2, 0.55 + 0.45 * hash2(65, x, 1) * dd, "low")
      if (hash2(65, x, 2) < 0.45 * dd) light(x, SHORE - 4, 0.4 + 0.5 * hash2(65, x, 3), "low")
    }
    // Waterfront: quay lamps right on the waterline, evenly spaced, denser downtown.
    if (o.quay !== false)
      for (var x = 4; x < W - 4; x += 3) if (hash2(66, x, 0) < 0.25 + 0.75 * density(x)) light(x, SHORE - 1, 0.62 + 0.38 * density(x) * hash2(66, x, 1), "low")
  }
  draw.lights = []
  return draw
}
