// Night palette sheet: checks lib/night_palette.px.js and shows how the existing night scenes map
// onto it. Read-only for studies: it recolours already-built PNGs, it never edits a study.
//
//   node art/scripts/night-sheet.mjs [build dir with scenes/*.png] [out dir]
//   defaults: art/out  →  art/out/night  (index.html, swatches.png, <scene>_compare.png)
//
// Checks: 32 colours per accent, ramps rise in lightness, no two colours closer than MIN_DE (OKLab).
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { fileURLToPath } from "node:url"
import { PNG } from "pngjs"

const ART = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BUILD = path.resolve(process.argv[2] ?? path.join(ART, "out"))
const OUT = path.resolve(process.argv[3] ?? path.join(ART, "out", "night"))
const MIN_DE = 0.035 // OKLab distance below which two palette colours read as one at 3×

// ---- load both palette files in a stub pxl context
const load = (file) => {
  const ctx = { use() {}, pal() {}, ramps() {}, include() {} }
  vm.createContext(ctx)
  vm.runInContext(fs.readFileSync(path.join(ART, file), "utf8"), ctx)
  return ctx
}
const OLD = load("palettes.px.js")
const NEW = load("lib/night_palette.px.js")
const OLD_KEYS = OLD.PALETTE_KEYS.join("").split("")
const RAMP_NAMES = ["sky", "moon", "haze", "teal", "land", "ground"]
const OLD_RAMP_NAMES = ["sky", "moon", "cloud", "far", "rock", "sand", "foliage"]

// ---- colour maths
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
function oklab(h) {
  const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
const dE = (a, b) => { const p = oklab(a), q = oklab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }

// ---- the new palette as { key, hex, ramp } entries
const base = []
NEW.NIGHT_BASE_KEYS.forEach((keys, r) => [...keys].forEach((k, i) => base.push({ key: k, hex: NEW.NIGHT_BASE[r][i], ramp: RAMP_NAMES[r] })))
const accentEntries = (name) => NEW.NIGHT_ACCENTS[name].colours.map((hex, i) => ({ key: String(i + 1), hex, ramp: name }))
const ACCENTS = Object.keys(NEW.NIGHT_ACCENTS)

// ---- checks
const problems = []
for (const name of ACCENTS) {
  const all = [...base, ...accentEntries(name)]
  if (all.length > 32) problems.push(`${name}: ${all.length} colours (> 32)`)
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const d = dE(all[i].hex, all[j].hex)
      if (d < MIN_DE) problems.push(`${name}: ${all[i].key} ${all[i].hex} ~ ${all[j].key} ${all[j].hex} (ΔE ${d.toFixed(3)})`)
    }
}
const rampsToCheck = [...NEW.NIGHT_BASE.map((r, i) => [RAMP_NAMES[i], r]),
  ...ACCENTS.filter((a) => a !== "neon").map((a) => [a, NEW.NIGHT_ACCENTS[a].colours]),
  ["neon pink", NEW.NIGHT_ACCENTS.neon.colours.slice(0, 3)], ["neon cyan", NEW.NIGHT_ACCENTS.neon.colours.slice(3)]]
for (const [name, ramp] of rampsToCheck)
  for (let i = 1; i < ramp.length; i++)
    if (oklab(ramp[i])[0] <= oklab(ramp[i - 1])[0]) problems.push(`${name}: step ${i} is not lighter than step ${i - 1}`)

// ---- how each existing night scene maps. Per old ramp: which new ramps it may land in (by role);
// each old key goes to the nearest colour (OKLab) among those.
const ROLE_DEFAULT = { sky: ["sky"], moon: ["moon"], cloud: ["haze", "moon", "sky"], far: ["haze", "sky"],
  rock: ["land"], sand: ["ground", "land"], foliage: ["teal"] }
const SCENES = [
  { name: "sky_night", palette: "night", accent: "silver", note: "Sky only: moon + halo. Silver accent is the natural fit." },
  { name: "desert_night", palette: "night", accent: "silver", note: "Far ranges → haze, rock → land, dunes → ground." },
  { name: "sea_night", palette: "night", accent: "silver", note: "Water is drawn from the sky ramp (mirrored sky), so it stays sky." },
  { name: "mountains_night", palette: "night", accent: "silver", note: "Far ranges → haze; snow/meadow sand slots → ground." },
  { name: "jungle_night", palette: "jungle_night", accent: "warm",
    roles: { far: ["teal"], foliage: ["teal"], sun: ["warm"] },
    note: "Foliage layers (far + foliage ramps) → teal. Fireflies (O, N, loop only) → warm 5, 3." },
  { name: "harbour_night", palette: "harbour_night", accent: "warm",
    roles: { far: ["teal"], rock: ["land", "sky", "haze", "moon"], sand: ["warm"], foliage: ["teal"], cloud: ["haze", "sky", "teal"] },
    note: "Its sand slots were already a warm accent: they become warm 1–5 one for one." },
  { name: "beach_night", palette: "beach_night", accent: "warm",
    roles: { foliage: ["teal"] }, coral: "warm",
    note: "Starfish coral (F, f, z) → warm 1–3: reads more orange than the dusky coral. Dune grass → teal." },
]
function mapScene(sc) {
  const oldHex = OLD.PALETTES[sc.palette].flat()
  const roles = { ...ROLE_DEFAULT, ...(sc.roles ?? {}) }
  const pool = (ramps) => [...base, ...accentEntries(sc.accent)].filter((e) => ramps.includes(e.ramp))
  const map = {}
  OLD_KEYS.forEach((k, idx) => {
    let r = OLD_RAMP_NAMES[OLD.PALETTE_KEYS.findIndex((s) => s.includes(k))]
    if (r === "sun" && sc.name !== "jungle_night") r = "moon" // night palettes: the sun slots are the moon
    let allowed = roles[r]
    if (sc.coral && r === "far" && "Ffz".includes(k)) allowed = [sc.coral]
    if (sc.name === "jungle_night" && r === "sun" && !"ON".includes(k)) allowed = ["moon"]
    const best = pool(allowed).reduce((a, e) => (dE(oldHex[idx], e.hex) < dE(oldHex[idx], a.hex) ? e : a))
    map[k] = { from: oldHex[idx], to: best.key, toHex: best.hex, ramp: best.ramp, dE: dE(oldHex[idx], best.hex) }
  })
  return map
}

// ---- PNG helpers
const readPng = (f) => PNG.sync.read(fs.readFileSync(f))
const writePng = (f, png) => fs.writeFileSync(f, PNG.sync.write(png))
function blank(w, h, hex) {
  const png = new PNG({ width: w, height: h }), [r, g, b] = hexRgb(hex)
  for (let i = 0; i < png.data.length; i += 4) png.data.set([r, g, b, 255], i)
  return png
}
function rect(png, x, y, w, h, hex) {
  const [r, g, b] = hexRgb(hex)
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) png.data.set([r, g, b, 255], (yy * png.width + xx) * 4)
}
const toHex = (d, i) => "#" + [0, 1, 2].map((k) => d[i + k].toString(16).padStart(2, "0")).join("")

fs.mkdirSync(OUT, { recursive: true })

// swatches.png: base ramps (one row each), then each accent; 1 swatch = 16×16, shown at 3×.
{
  const S = 16, G = 4, rows = NEW.NIGHT_BASE.length + ACCENTS.length + 1
  const png = blank(5 * (S + G) + G, rows * (S + G) + G, "#3a3a3a") // neutral, so B (near-black) shows
  NEW.NIGHT_BASE.forEach((ramp, r) => ramp.forEach((h, i) => rect(png, G + i * (S + G), G + r * (S + G), S, S, h)))
  ACCENTS.forEach((a, j) => NEW.NIGHT_ACCENTS[a].colours.forEach((h, i) =>
    rect(png, G + i * (S + G), G + (NEW.NIGHT_BASE.length + 1 + j) * (S + G), S, S, h)))
  writePng(path.join(OUT, "swatches.png"), png)
}

// <scene>_compare.png: original | remapped, side by side (logical size; view at 3×).
const results = []
for (const sc of SCENES) {
  const file = path.join(BUILD, "scenes", sc.name + ".png")
  if (!fs.existsSync(file)) { results.push({ ...sc, missing: true }); continue }
  const src = readPng(file), map = mapScene(sc), byHex = {}
  OLD_KEYS.forEach((k) => { byHex[map[k].from] ??= k })
  const used = {}, total = src.width * src.height
  const cmp = blank(src.width * 2 + 8, src.height, "#000000")
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4, h = toHex(src.data, i), k = byHex[h]
      rect(cmp, x, y, 1, 1, h)
      rect(cmp, src.width + 8 + x, y, 1, 1, k ? map[k].toHex : "#ff00ff") // magenta = off-palette pixel
      if (k) used[k] = (used[k] ?? 0) + 1
    }
  writePng(path.join(OUT, sc.name + "_compare.png"), cmp)
  const rows = Object.entries(used).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ old: k, pct: (100 * n) / total, ...map[k] }))
  results.push({ ...sc, rows, newKeys: [...new Set(rows.map((r) => r.to))].length })
}

// index.html: swatches, glow chains, and one mapping table per scene.
const sw = (h, label = "") => `<span class="sw" style="background:${h}" title="${h}">${label}</span>`
const chainHtml = (a) => {
  const A = NEW.NIGHT_ACCENTS[a], col = (k) => (/\d/.test(k) ? A.colours[+k - 1] : base.find((e) => e.key === k).hex)
  return [A.chain, A.chain2].filter(Boolean).map((c) => [...c].map((k) => sw(col(k), k)).join("→")).join(" &nbsp; ")
}
const html = `<!doctype html><meta charset="utf-8"><title>Night Palette</title>
<style>
:root{--bg:#0d0e16;--fg:#d9dcea;--mute:#8a8fa8;--line:#262a3c}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
main{max-width:1100px;margin:auto}h1,h2{font-weight:600}h2{margin-top:2.2em;border-top:1px solid var(--line);padding-top:1em}
.sw{display:inline-flex;align-items:flex-end;justify-content:center;width:44px;height:44px;margin:2px;border-radius:3px;
font:11px ui-monospace,monospace;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000;padding-bottom:2px;box-sizing:border-box;vertical-align:middle}
.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:4px 0}.row b{width:70px}.mute{color:var(--mute)}
.small .sw{width:22px;height:22px;font-size:10px}table{border-collapse:collapse;margin:8px 0;font:12px ui-monospace,monospace}
td,th{padding:2px 8px;border-bottom:1px solid var(--line);text-align:left}.warn{color:#f6bd52}
img{image-rendering:pixelated;width:100%;max-width:736px;display:block;margin:8px 0}.ok{color:#3a7d78}
</style><main>
<h1>Night palette — night_base + one accent (32)</h1>
<p class="mute">Generated by art/scripts/night-sheet.mjs from art/lib/night_palette.px.js. Existing studies are untouched: the right half of each comparison is a recolour of the built PNG.</p>
<p>${problems.length ? `<span class="warn">Checks: ${problems.length} problem(s)</span><br>${problems.join("<br>")}` : `<span class="ok">Checks pass:</span> 32 colours per accent, every ramp rises in lightness, no pair closer than ΔE ${MIN_DE} (OKLab).`}</p>
<h2>night_base (27)</h2>
${NEW.NIGHT_BASE.map((r, i) => `<div class="row"><b>${RAMP_NAMES[i]}</b>${r.map((h, j) => sw(h, NEW.NIGHT_BASE_KEYS[i][j])).join("")}<span class="mute">${r.join(" ")}</span></div>`).join("")}
<h2>Accent ramps (5, keys 1–5) and their glow chains</h2>
${ACCENTS.map((a) => `<div class="row"><b>${a}</b>${NEW.NIGHT_ACCENTS[a].colours.map((h, j) => sw(h, j + 1)).join("")}<span class="mute">chain (core → out):</span> <span class="small">${chainHtml(a)}</span></div>`).join("")}
<h2>Existing night scenes → night_base + accent</h2>
<p class="mute">Each old key goes to the nearest new colour (OKLab) inside the new ramp(s) its role allows. ΔE &gt; 0.08 = a visible shift (marked).</p>
${results.map((r) => r.missing ? `<h3>${r.name}</h3><p class="warn">not built</p>` : `<h3>${r.name} <span class="mute">(${r.palette} → night_base + ${r.accent}; ${r.rows.length} old keys → ${r.newKeys} new)</span></h3>
<p>${r.note}</p><img src="${r.name}_compare.png" alt="${r.name}: original left, remapped right">
<table><tr><th>old</th><th></th><th>% px</th><th></th><th>new</th><th>ramp</th><th>ΔE</th></tr>
${r.rows.map((x) => `<tr><td>${x.old}</td><td class="small">${sw(x.from)}</td><td>${x.pct.toFixed(2)}</td><td class="small">${sw(x.toHex)}</td><td>${x.to}</td><td>${x.ramp}</td><td class="${x.dE > 0.08 ? "warn" : ""}">${x.dE.toFixed(3)}</td></tr>`).join("")}</table>`).join("")}
</main>`
fs.writeFileSync(path.join(OUT, "index.html"), html)
fs.writeFileSync(path.join(OUT, "mapping.json"), JSON.stringify(results.map(({ name, palette, accent, rows }) => ({ name, palette, accent, rows })), null, 1))

console.log(problems.length ? "PROBLEMS:\n  " + problems.join("\n  ") : "checks pass")
for (const r of results)
  if (!r.missing) console.log(`${r.name}: ${r.rows.length} keys → ${r.newKeys}; max ΔE ${Math.max(...r.rows.map((x) => x.dE)).toFixed(3)}; ` +
    r.rows.filter((x) => x.dE > 0.08).map((x) => `${x.old}→${x.to} ${x.dE.toFixed(2)} (${x.pct.toFixed(1)}%)`).join(", "))
console.log("->", OUT)
