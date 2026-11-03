// Phase 1 palettes: 6 ramps × 5 colours + 2 foliage greens = 32 colours (the max).
// Usage at the top of a study:  include("../palettes.px.js"); palette("dusk")
//
// Dusk is built from the ramps in docs/art-direction.md for a desert landscape
// (sky = the `dusk` ramp, then sun, cloud, far, rock, sand). No vehicle/metal ramp: Phase 1
// has no vehicles. Sunrise, day and night are palette swaps: same keys, same order, same roles.
//
// Each ramp runs deepShadow → shadow → base → light → highlight.
// Keys follow one rule per ramp, with three letters:
//   1st letter: SHADOW = UPPER, BASE  = lower    (the two colours used most)
//   2nd letter: DEEP   = UPPER, LIGHT = lower    (crevices/outlines, lit faces)
//   3rd letter: HIGHLIGHT, lower                 (rim light only, sparingly)
// Uppercase is always the shadow side.
//
//   ramp   deep shadow base light high   mnemonic
//   sky     U    D      d    u     k     DUsK
//   sun     O    N      n    o     w     suN, glOw, white-hot
//   cloud   L    C      c    l     m     CLoud, mist
//   far     H    F      f    h     z     Far Haze, horiZon
//   rock    B    R      r    b     t     Rock, Boulder, top
//   sand    A    S      s    a     g     SAnd, glint
//
// Foliage (added for the jungle): two greens, J (dark) and j (mid) — Jungle, uppercase = shadow.
// They sit inside a hue-shifted foliage ramp that borrows its ends from other ramps:
//   H (far deep, blue-violet shadow) → J → j → a (sand light, warm sunlit edge) → g (glint)
// so leaves get cool shadows and warm lights with only two new colours.

// Key order shared by every palette (ramp order, dark → light).
var PALETTE_KEYS = ["UDduk", "ONnow", "LCclm", "HFfhz", "BRrbt", "ASsag", "Jj"]
// Ramps for shade()/light()/glow: the six material ramps, then the foliage ramp. Keys already in
// an earlier ramp (H, a, g) keep stepping along that one; J and j step along the foliage ramp.
var PALETTE_RAMPS = ["UDduk", "ONnow", "LCclm", "HFfhz", "BRrbt", "ASsag", "HJjag"]

var PALETTES = {
  // From docs/art-direction.md, unchanged: dusk, sun, cloud, far, rock, sand.
  dusk: [
    ["#2a1f4a", "#5a2f5e", "#9a4462", "#d9705a", "#f6b06a"], // sky   (art-direction `dusk`)
    ["#b8442a", "#e0743a", "#f4a44a", "#fcd27a", "#fff4c8"], // sun
    ["#5a5a86", "#8a8cb2", "#b8bad4", "#dfe0ee", "#fbf6ec"], // cloud
    ["#2b2d52", "#3d4270", "#56608e", "#7a86ac", "#a9b4cc"], // far
    ["#2a1f2a", "#4a3438", "#6e4e48", "#96705c", "#c09a78"], // rock
    ["#4a2e36", "#7a4a40", "#b07450", "#d8a066", "#f2cc8a"], // sand
    ["#1f4a3a", "#5b7d3c"],                                  // foliage J, j (dark teal-green, warm olive)
  ],
  // Dawn: the sky goes cooler and lighter (indigo → lavender → pink → peach → pale gold), the sun
  // paler, and the ground picks up a violet cast from the cold sky.
  sunrise: [
    ["#2c2a5a", "#5a4a86", "#b06a8a", "#f0a08a", "#fbe0a8"], // sky
    ["#c25a3a", "#ec8a4a", "#f8b860", "#fde090", "#fff8dc"], // sun
    ["#5e5a8a", "#9088b4", "#c4b8d6", "#ecdcec", "#fff4ec"], // cloud
    ["#343560", "#4a4d80", "#6a6e9c", "#9196bc", "#c0c4dc"], // far
    ["#2a2032", "#4a3646", "#6e5058", "#9a7468", "#c8a084"], // rock
    ["#4a3040", "#7a4c4c", "#b0785c", "#dca474", "#f6d29a"], // sand
    ["#24483c", "#62843e"],                                  // foliage
  ],
  // Noon: the sky ramp becomes art-direction `sky`; every other ramp is already the
  // neutral daylight version in the doc.
  day: [
    ["#2c4c8a", "#3a6cb0", "#5590d0", "#86bce4", "#c6e4f2"], // sky   (art-direction `sky`)
    ["#b8442a", "#e0743a", "#f4a44a", "#fcd27a", "#fff4c8"], // sun
    ["#5a5a86", "#8a8cb2", "#b8bad4", "#dfe0ee", "#fbf6ec"], // cloud
    ["#2b2d52", "#3d4270", "#56608e", "#7a86ac", "#a9b4cc"], // far
    ["#2a1f2a", "#4a3438", "#6e4e48", "#96705c", "#c09a78"], // rock
    ["#4a2e36", "#7a4a40", "#b07450", "#d8a066", "#f2cc8a"], // sand
    ["#1e4a32", "#4f8e42"],                                  // foliage (art-direction `grass`)
  ],
  // Moonlight: the sky ramp becomes art-direction `night`, the sun slot becomes a cold moon
  // ramp, and every material drops about two steps and leans blue/violet.
  night: [
    ["#0b0b1e", "#161a3a", "#232b5c", "#33427e", "#4a5f9e"], // sky   (art-direction `night`)
    ["#4a5a8a", "#7a8ab8", "#a8b8d8", "#d4def0", "#f4f6fc"], // sun → moon
    ["#141838", "#232a52", "#3a4470", "#56628e", "#8290b8"], // cloud
    ["#0e1028", "#171c3e", "#222a54", "#313c6a", "#485684"], // far
    ["#0c0a18", "#18142a", "#262040", "#3a3256", "#564c74"], // rock
    ["#120e22", "#221a36", "#34284a", "#4c3c60", "#6c5a7c"], // sand
    ["#0f2228", "#22403a"],                                  // foliage (moonlit blue-greens)
  ],
}

// Variant for jungle_night only: the night palette with two slots that scene never uses recoloured
// warm for the fireflies (the night palette has no warm colour). O = firefly core (warm yellow),
// N = its glow ring (amber). Same 32 slots, same order; every other scene is unaffected.
PALETTES.jungle_night = PALETTES.night.map(function (ramp, r) {
  return r === 1 ? ["#ffe27a", "#d8963a"].concat(ramp.slice(2)) : ramp
})

// harbour_night: a locked palette for the harbour showcase. Same 32 slots (so skyLayer and the
// shared code work), its own values: navy and teal everywhere, with the sand slots as the single
// warm accent ramp for the city lights. Not a swap of the others; only harbour_night uses it.
PALETTES.harbour_night = [
  ["#070b1a", "#0d1530", "#152346", "#1f3558", "#2c4a6c"], // sky: deep navy → slate-teal at the horizon
  ["#3a4f6e", "#6a7f9c", "#a6b6c8", "#d4dde6", "#f2f5f7"], // moon: cool pale
  ["#0e1a2c", "#16283c", "#20384e", "#2e4c62", "#46677c"], // cloud bank: navy-teal
  ["#08121c", "#0e1e2a", "#15303a", "#1e434c", "#2c5a60"], // far: hills and water, teal
  ["#04060c", "#0a0f1c", "#121a2c", "#1c2a40", "#5a7290"], // rock: frame, sill, buildings (t = moonlit edge)
  ["#5a2e1c", "#a0501e", "#e08a2e", "#f8c25a", "#fff0b8"], // sand slots = the warm lights: ember → gold → cream
  ["#0a1820", "#13303a"],                                  // foliage slots = water teals
]

/** Activate a palette: only its 32 keys exist afterwards, with ramps for shade/light/glow. */
function palette(name) {
  var p = PALETTES[name]
  if (!p) throw new Error("unknown palette '" + name + "' (have: " + Object.keys(PALETTES).join(", ") + ")")
  var map = {}
  PALETTE_KEYS.forEach(function (keys, r) {
    for (var i = 0; i < keys.length; i++) map[keys[i]] = p[r][i]
  })
  use([]) // drop pico8's 0-f keys so nothing outside the palette is reachable by key
  pal(map)
  ramps.apply(null, PALETTE_RAMPS)
}
