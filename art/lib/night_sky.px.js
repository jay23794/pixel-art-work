// Night sky for the night kit: gradient, stars, moon (full or crescent) with a stepped halo, clouds.
//   nightPalette("silver")                       // or nightPalette(accent, legacy) for a ported study
//   scene("x", { w: 360, h: 640, bg: "U" }, ...nightSky({ moon: { x: 262, y: 150 } }), ...)
// Extracted from skyLayer("night") (lib/sky.px.js): same layout, same stars, same moon, so ported
// studies keep every pixel. Draws through nightRoles(), so it works in plain and legacy mode.
// Top-level `function`/`var` only (see art/CLAUDE.md).
include("night_palette.px.js")
include("sky.px.js")

/**
 * The night sky as scene items (spread into a scene, after nightPalette()).
 * opts.horizon (default 456): scales the layout vertically (gradient, moon, clouds, star limit).
 * opts.gradient (default "UUUUDDDddu"): sky keys top → horizon, in night-palette roles.
 * opts.moon: { x, y } places the disk; { crescent: { dx, dy } } cuts it with an offset disk.
 * opts.glow: { r, ramp } (default { r: 14, ramp: 1 }) a ramp halo from the disk;
 *   { rings: [2.5, 5.5] } flat rings by true distance to the lit pixels (even all round, for
 *   crescents); false = none.
 * opts.stars: { maxY, density } (default: all, density 1); false = none.
 * opts.clouds: { amount } 0 none, 1 cumulus only, 2 cumulus + stratus (default); { scale, x, y,
 *   top, stratus: { hide } } position them (as skyLayer).
 * opts.motion (anims, from c.phase): { clouds: px } sway, { twinkle: { n, maxY } }.
 * opts.layer: "back" (no stars, stamp it once) | "stars" (only the stars, per frame).
 */
function nightSky(opts) {
  opts = opts || {}
  var R = nightRoles(), T = skySetup("night", opts), mo = opts.motion || {}, moon = T.moon
  var st = opts.stars === false ? null : opts.stars || {}
  var amount = opts.clouds && opts.clouds.amount !== undefined ? opts.clouds.amount : 2
  if (amount < 2) T.stratus = []
  if (amount < 1) T.cumulus = []
  var gl = opts.glow === undefined ? T.glow : opts.glow
  var sky = R(opts.gradient || T.sky), cloud = R(T.cloud)
  function sway(c) { return mo.clouds ? Math.round(mo.clouds * Math.sin(2 * Math.PI * (c.phase || 0))) : 0 }
  var halo = function () {}
  if (gl && gl.rings) halo = function (c) { nightHalo(c, moon, gl.rings, R) }
  else if (gl && gl.r > 0) halo = glow(R("onw"), { r: gl.r, ramp: gl.ramp, bands: gl.ramp, where: [moon.x, moon.y, moon.r + 1] })
  var items = [
    grad(0, 0, SKY_W, T.horizon, sky, "v", 0.6),
    rect(0, T.horizon, SKY_W, SKY_H - T.horizon, sky[sky.length - 1]),
    function (c) { if (st) skyStars(c, moon, T.starLimit, mo.twinkle, c.phase || 0, st.maxY, st.density, R) },
    function (c) { skyMoonDisk(c, moon, R) },
    halo,
    function (c) {
      var dx = sway(c)
      T.stratus.forEach(function (s) { skyStratus(c, dx ? Object.assign({}, s, { x: s.x + dx }) : s, cloud, moon) })
      T.cumulus.forEach(function (s) { skyCumulus(c, dx ? Object.assign({}, s, { x: s.x + dx }) : s, cloud, moon) })
    },
  ]
  if (opts.layer === "back") items[2] = function () {}
  if (opts.layer === "stars") return [items[2]]
  return items
}

/** Where nightSky(opts)'s moon is: { x, y, r }. Studies light from it. */
function nightLight(opts) {
  return skySetup("night", opts || {}).moon
}

/**
 * Moon halo as flat rings by true distance to the lit moon pixels, so the steps stay even all the
 * way round (inner curve of a crescent included). rings: distances, inner first ([2.5, 5.5] = two
 * rings). A ring only ever brightens the sky under it (U < D < d < ...). From harbour_night.
 */
function nightHalo(c, moon, rings, R) {
  var lit = [], reach = Math.max(8, Math.ceil(rings[rings.length - 1]) + 3), skyK = R("UDduk"), moonK = R("ONnow")
  for (var y = moon.y - moon.r - reach; y <= moon.y + moon.r + reach; y++)
    for (var x = moon.x - moon.r - reach; x <= moon.x + moon.r + reach; x++) if (moonK.indexOf(c.key(x, y)) >= 0) lit.push([x, y])
  for (var y = moon.y - moon.r - reach; y <= moon.y + moon.r + reach; y++)
    for (var x = moon.x - moon.r - reach; x <= moon.x + moon.r + reach; x++) {
      var cur = skyK.indexOf(c.key(x, y))
      if (cur < 0) continue // moon or star pixel
      var d = 99
      lit.forEach(function (p) { d = Math.min(d, Math.hypot(x - p[0], y - p[1])) })
      var ring = 0
      rings.forEach(function (r) { if (d <= r) ring++ })
      if (ring > cur) c.px(x, y, skyK[ring])
    }
}

/**
 * For studies drawn at dusk and at night from one scene function: activates the time's palette
 * (night: nightPalette(accent, legacy)) and returns { sky(opts) → sky items, end → items that close
 * the legacy drawing (nightRemap at night, nothing at dusk) }.
 */
function nightOrPalette(time, accent, legacy) {
  if (time === "night") {
    nightPalette(accent, legacy)
    return { sky: nightSky, end: [nightRemap()] }
  }
  palette(time)
  return { sky: function (o) { return skyLayer(time, o) }, end: [] }
}
