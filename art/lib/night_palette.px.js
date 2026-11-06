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
//
// Glow: no additive light. A light source is drawn as stepped rings, core outward, along its
// accent's `chain`; the last ring steps onto the base colour underneath (see docs/night-notes.md).

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

/** Activate night_base + one accent: exactly 32 keys exist afterwards, with ramps for shade/light. */
function nightPalette(accent) {
  var a = NIGHT_ACCENTS[accent]
  if (!a) throw new Error("unknown night accent '" + accent + "' (have: " + Object.keys(NIGHT_ACCENTS).join(", ") + ")")
  var map = {}
  NIGHT_BASE_KEYS.forEach(function (keys, r) {
    for (var i = 0; i < keys.length; i++) map[keys[i]] = NIGHT_BASE[r][i]
  })
  for (var i = 0; i < 5; i++) map[NIGHT_ACCENT_KEYS[i]] = a.colours[i]
  use([]) // drop pico8's 0-f keys so nothing outside the palette is reachable by key
  pal(map)
  // Base ramps first (first ramp wins for shared keys), then the accent as one light ramp, or as
  // its two hues for neon.
  var accentRamps = accent === "neon" ? ["123", "hz45"] : [NIGHT_ACCENT_KEYS]
  ramps.apply(null, NIGHT_BASE_KEYS.concat(accentRamps))
}
