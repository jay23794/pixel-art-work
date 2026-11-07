// Shared hooks for the land modules (lib/land_*.px.js): each wraps one approved study's drawing in a
// function, so the study and night_scene.px.js (JSON scenes) run the same code. A module's
// define(time, o) defines the assets; with o = {} it is exactly the study.
//   o.name     asset base name (default: the study's)        o.accent  night accent override
//   o.sky(opts) → items (default: the study's sky; night_scene passes nsSky for a hidden moon)
//   o.skyOpts(opts) → opts (adjust the study's sky options: stars, clouds)
//   o.stage(name, animate) → items inserted at a named depth: "back" (just in front of the far
//     land/water: low fog), "front" (in front of the land, behind a foreground frame: rain, lights)
//   o.moon     false: no moon reflections/patches (hidden moon)
//   o.still(x, y) → false where night_scene moves things (kept out of the study's static mask)
// Top-level `function`/`var` only (see art/CLAUDE.md).

/** The sky items for opts, through o.skyOpts / o.sky when given. */
function landSky(P, o) {
  return function (opts) {
    if (o.skyOpts) opts = o.skyOpts(opts)
    return o.sky ? o.sky(opts) : P.sky(opts)
  }
}

/** Items for a named stage; in legacy mode a nightRemap() first (fog/rain read night colours). */
function landStage(o, legacy) {
  return function (name, animate) {
    var it = (o.stage && o.stage(name, animate)) || []
    return it.length && legacy ? [nightRemap()].concat(it) : it
  }
}
