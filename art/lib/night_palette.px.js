// Night palette system: one master base (27 colours) + one swappable accent ramp (5) = 32.
// Usage at the top of a night study:  include("../lib/night_palette.px.js"); nightPalette("warm")
//
// Why a base + accent: every night scene so far patched a few "unused" slots of the night palette
// for its one warm or odd colour (jungle_night: O/N, harbour_night: the whole sand ramp,
// beach_night: F/f/z). Here the accent has its own keys, so a scene swaps accents without
// touching the base, and the base never loses a slot.
//
// Base ramps (dark → light, same letter rule as palettes.px.js: UPPER = shadow side):
//   ramp    keys    role
//   sky     UDduk   zenith → horizon; also the sky mirrored in calm water
//   moon    Nnow    moon disc, moonlit rims and the moon path on water (N = cold rim, w = core)
//   haze    LCcl    clouds, mist, fog, far ranges (atmospheric depth)
//   teal    HFfhz   water, far hills, foliage (night greens turn teal), wet surfaces
//   land    BRrbt   rock, dark earth, silhouettes (B is the darkest colour in the palette)
//   ground  ASsa    sand, soil, paths: mauve, the base's warmest ramp
// Accent ramps share the keys 1–5. warm and silver run dark → bright. neon is two-hued:
//   1 2 3 = magenta → pink core, 4 5 = cyan tube → cyan core.
// **Accents are for light sources only** (lamps, windows, signs, fireflies, the moon's halo,
// lightning) and the light they throw. Objects and materials (a starfish, a boat, a roof) use base
// colours, even when they are colourful by day.
//
// Glow: no additive light. A light source is drawn as stepped rings, core outward, along its
// accent's `chain`; the last ring steps onto the base colour underneath (see lib/night_lights.px.js).
//
// ---- Legacy mode (scenes ported from palettes.px.js)
// nightPalette(accent, legacy) also defines the old palette's 32 keys with their OLD colours, so a
// study's terrain code (which tests colours with c.is / c.key) draws exactly as before. The night
// colours then live under spare keys (Greek letters) and a nightRemap() item turns every old colour
// into its night colour (NIGHT_LEGACY[legacy]). Shapes are identical by construction.
// Kit modules never use letters directly: they capture nightKeys() (night key → key in this
// palette) and nightRoles() (old night-palette letter → key in this palette) when their items are
// created, so the same module works in plain and legacy mode.
include("../palettes.px.js")

var NIGHT_BASE_KEYS = ["UDduk", "Nnow", "LCcl", "HFfhz", "BRrbt", "ASsa"]
var NIGHT_ACCENT_KEYS = "12345"

var NIGHT_BASE = [
  ["#0a0b1d", "#131a3a", "#1c2a55", "#263f6e", "#355a86"], // sky: navy-violet zenith → teal-slate horizon
  ["#4f6a96", "#8ea6c8", "#c4d4e8", "#eef4fa"],            // moon: cold rim → pale blue → ice → core
  ["#323852", "#464c6c", "#686a88", "#8890ac"],            // haze: grey-violet cloud/mist, lit by n/o
  ["#08171f", "#0e2a33", "#164048", "#21585c", "#3a7d78"], // teal: deep water → moonlit ripple / leaf edge
  ["#07060d", "#16112a", "#261d40", "#3a2c5a", "#5d4c82"], // land: ink → violet rock → moonlit edge
  ["#28172a", "#3c2640", "#5a3c58", "#7e6080"],            // ground: mauve sand / soil in moonlight
]

var NIGHT_ACCENTS = {
  // Lamps, windows, fireflies, campfire. Chain core → out: cream, gold, amber, rust, ember.
  warm: { colours: ["#3e1f1e", "#8c3f22", "#d4802c", "#f6bd52", "#fff0bc"], chain: "54321" },
  // Signs and tubes. Pink chain 3 → 2 → 1; cyan chain 5 → 4, then base teal z → h.
  neon: { colours: ["#3c1042", "#b02a80", "#ff8ad8", "#1ab6c6", "#bafff4"], chain: "321", chain2: "54zh" },
  // Moon halo and silver sheen: lavender-silver rings that sit between the moon ramp and the sky.
  silver: { colours: ["#2a3274", "#423f88", "#5e5ca8", "#8684c8", "#b8b4e8"], chain: "5432" },
}

// Old key → night key, per legacy palette (the approved step-1 mapping, art/scripts/night-sheet.mjs;
// starfish F f z → ground S s a: accents are for light sources only).
var NIGHT_LEGACY = {
  night: "UU DD dd uu kk ON Nn nn oo ww LD Cd cu lN ml HU FD fd hu zk BB RR rr bb tt AR Sr sS as ga JF jf",
  jungle_night: "UU DD dd uu kk O4 N3 nn oo ww LD Cd cu lN ml HH FF fF hf zh BB RR rr bb tt AR Sr sS as ga JF jf",
  harbour_night: "UU DD dD ud ku ON NN nn oo ww LH CF cL lC mk HH FH fF hf zh BB RU rD bd tc A1 S2 s3 a4 g5 JH jF",
  beach_night: "UU DD dd uu kk ON Nn nn oo ww LD Cd cu lN ml HU FS fs hu za BB RR rr bb tt AR Sr sS as ga JF jf",
}
// Spare keys for the night colours in legacy mode (27 base, in NIGHT_BASE_KEYS order).
var NIGHT_SPARE = "αβγδεζηθικλμνξπρστυφχψωϐϑϒϕ"

// State of the last nightPalette() call (definition time). Modules capture it in their items.
var NIGHT_STATE = null

/**
 * Activate night_base + one accent: 32 night colours with ramps for shade/light/glow.
 * legacy (optional): an old palette name (NIGHT_LEGACY) whose keys and colours stay drawable; end
 * the scene's legacy drawing with a nightRemap() item.
 */
function nightPalette(accent, legacy) {
  var a = NIGHT_ACCENTS[accent]
  if (!a) throw new Error("unknown night accent '" + accent + "' (have: " + Object.keys(NIGHT_ACCENTS).join(", ") + ")")
  if (legacy && !NIGHT_LEGACY[legacy]) throw new Error("unknown legacy palette '" + legacy + "' (have: " + Object.keys(NIGHT_LEGACY).join(", ") + ")")
  var keys = {}, hex = {}, map = {}, i = 0 // keys: night key → key in this palette; hex: night key → colour
  NIGHT_BASE_KEYS.forEach(function (ks, r) {
    for (var j = 0; j < ks.length; j++, i++) { hex[ks[j]] = NIGHT_BASE[r][j]; keys[ks[j]] = legacy ? NIGHT_SPARE[i] : ks[j] }
  })
  for (var k = 0; k < 5; k++) { hex[NIGHT_ACCENT_KEYS[k]] = a.colours[k]; keys[NIGHT_ACCENT_KEYS[k]] = NIGHT_ACCENT_KEYS[k] }
  var remap = null, old = null
  if (legacy) {
    old = {}; remap = {}
    var colours = PALETTES[legacy].flat(), letters = PALETTE_KEYS.join("")
    for (var o = 0; o < letters.length; o++) old[letters[o]] = colours[o]
    NIGHT_LEGACY[legacy].split(" ").forEach(function (pair) { remap[pair[0]] = pair[1] })
    var night = {}
    Object.keys(hex).forEach(function (nk) { night[hex[nk].toLowerCase()] = nk })
    Object.keys(old).forEach(function (ok) {
      if (!remap[ok]) throw new Error("NIGHT_LEGACY." + legacy + " has no target for '" + ok + "'")
      if (night[old[ok].toLowerCase()]) throw new Error(legacy + " colour " + old[ok] + " ('" + ok + "') is also a night colour: remap would be ambiguous")
    })
  }
  Object.keys(keys).forEach(function (nk) { map[keys[nk]] = hex[nk] })
  if (old) Object.keys(old).forEach(function (ok) { map[ok] = old[ok] })
  use([]) // drop pico8's 0-f keys so nothing outside the palette is reachable by key
  pal(map)
  // Ramps: the old palette's first (legacy drawing steps along them, as before), then the night
  // ramps (in this palette's keys), then the accent as one ramp, or its two hues for neon.
  var tr = function (s) { return s.split("").map(function (c) { return keys[c] }).join("") }
  var rs = (legacy ? PALETTE_RAMPS.slice() : []).concat(NIGHT_BASE_KEYS.map(tr))
  rs = rs.concat(accent === "neon" ? ["123", tr("hz") + "45"] : [NIGHT_ACCENT_KEYS])
  ramps.apply(null, rs)
  NIGHT_STATE = { accent: accent, legacy: legacy || null, keys: keys, hex: hex, remap: remap, chain: a.chain, chain2: a.chain2 || null }
  return NIGHT_STATE
}

/** night key → key in the active night palette (identity in plain mode). Call at definition time. */
function nightKeys() {
  if (!NIGHT_STATE) throw new Error("nightKeys(): call nightPalette() first")
  var K = NIGHT_STATE.keys
  var f = function (s) { return s.split("").map(function (c) { if (!K[c]) throw new Error("not a night key: '" + c + "'"); return K[c] }).join("") }
  f.state = NIGHT_STATE
  return f
}

/**
 * Old night-palette letter (palettes.px.js `night` roles: sky UDduk, stars/moon lmnow, clouds LCclm)
 * → key in the active palette. Legacy mode: the letter itself (drawn in its old colour, remapped
 * later). Plain mode: the night key it maps to (NIGHT_LEGACY.night). Lets one sky drawing serve
 * both modes. Call at definition time.
 */
function nightRoles() {
  var K = nightKeys(), legacy = NIGHT_STATE.legacy, m = {}
  NIGHT_LEGACY.night.split(" ").forEach(function (p) { m[p[0]] = p[1] })
  return function (s) { return legacy ? s : K(s.split("").map(function (c) { return m[c] }).join("")) }
}

/**
 * Item: turn every old-palette colour into its night colour (legacy mode; a no-op in plain mode).
 * Place it after the legacy drawing; it can run again after later legacy layers (night colours are
 * never touched). Fails the build if a colour is left that is neither old nor night.
 */
function nightRemap() {
  var S = NIGHT_STATE
  if (!S) throw new Error("nightRemap(): call nightPalette() first")
  return function (c) {
    if (!S.remap) return
    var from = new Map(), ok = new Set()
    Object.keys(S.remap).forEach(function (o) { from.set(c.color(o) >>> 0, S.keys[S.remap[o]]) })
    Object.keys(S.keys).forEach(function (nk) { ok.add(c.color(S.keys[nk]) >>> 0) })
    for (var y = 0; y < c.h; y++)
      for (var x = 0; x < c.w; x++) {
        var col = c.get(x, y) >>> 0
        if ((col & 0xff) === 0 || ok.has(col)) continue
        var to = from.get(col)
        if (to === undefined) throw new Error("nightRemap: colour #" + col.toString(16).padStart(8, "0").slice(0, 6) + " at (" + x + ", " + y + ") is neither " + S.legacy + " nor night")
        c.px(x, y, to)
      }
  }
}
