// Acceptance check for scenes ported onto the night kit: the new render must equal the old render
// (art/out/night/v1) with every old colour replaced by its night colour (NIGHT_LEGACY in
// lib/night_palette.px.js), pixel for pixel, still and every loop frame. Differences are listed
// with their bounding box, so intended changes (jungle shafts, starfish, harbour flicker) can be
// told from accidents. Also checks that the new render only uses the scene's 32 night colours.
//
//   node art/scripts/night-port-check.mjs [v1 dir] [new dir] [out dir]
//   defaults: art/out/night/v1  art/out/night/v2  art/out/night/check
// Writes <scene>_before_after.png (old | new, 1×) and <scene>_diff.png (new, mismatches magenta).
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { fileURLToPath } from "node:url"
import { PNG } from "pngjs"

const ART = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const V1 = path.resolve(process.argv[2] ?? path.join(ART, "out/night/v1"))
const V2 = path.resolve(process.argv[3] ?? path.join(ART, "out/night/v2"))
const OUT = path.resolve(process.argv[4] ?? path.join(ART, "out/night/check"))

const ctx = { use() {}, pal() {}, ramps() {}, include() {} }
vm.createContext(ctx)
vm.runInContext(fs.readFileSync(path.join(ART, "palettes.px.js"), "utf8"), ctx)
vm.runInContext(fs.readFileSync(path.join(ART, "lib/night_palette.px.js"), "utf8"), ctx)

// scene → [legacy palette, accent]
const SCENES = {
  mountains_night: ["night", "silver"], desert_night: ["night", "silver"], sea_night: ["night", "silver"],
  jungle_night: ["jungle_night", "warm"], harbour_night: ["harbour_night", "warm"], beach_night: ["beach_night", "silver"],
}
const only = process.env.ONLY ? process.env.ONLY.split(",") : null

const nightHex = (accent) => {
  const h = {}
  ctx.NIGHT_BASE_KEYS.forEach((ks, r) => [...ks].forEach((k, i) => (h[k] = ctx.NIGHT_BASE[r][i])))
  ctx.NIGHT_ACCENTS[accent].colours.forEach((c, i) => (h[String(i + 1)] = c))
  return h
}
const toHex = (d, i) => "#" + [0, 1, 2].map((k) => d[i + k].toString(16).padStart(2, "0")).join("")
const read = (f) => (fs.existsSync(f) ? PNG.sync.read(fs.readFileSync(f)) : null)

fs.mkdirSync(OUT, { recursive: true })
let failed = false
for (const [name, [legacy, accent]] of Object.entries(SCENES)) {
  if (only && !only.includes(name)) continue
  const NH = nightHex(accent), allowed = new Set(Object.values(NH))
  const oldHex = ctx.PALETTES[legacy].flat(), letters = ctx.PALETTE_KEYS.join("")
  const remap = Object.fromEntries(ctx.NIGHT_LEGACY[legacy].split(" ").map((p) => [p[0], p[1]]))
  const expect = {}
  ;[...letters].forEach((k, i) => (expect[oldHex[i]] = NH[remap[k]]))

  const report = []
  for (const kind of ["scenes", "anims"]) {
    const file = kind === "scenes" ? name : name + "_loop"
    const a = read(path.join(V1, kind, file + ".png")), b = read(path.join(V2, kind, file + ".png"))
    if (!a || !b) { report.push(`${file}: missing (${!a ? "v1" : "new"})`); failed = true; continue }
    if (a.width !== b.width || a.height !== b.height) { report.push(`${file}: size differs`); failed = true; continue }
    const W = 360, frames = a.width / W
    const diff = new PNG({ width: a.width, height: a.height })
    b.data.copy(diff.data)
    let bad = 0, foreign = 0, unknownOld = 0
    const box = Array.from({ length: frames }, () => null)
    for (let y = 0; y < a.height; y++)
      for (let x = 0; x < a.width; x++) {
        const i = (y * a.width + x) * 4, ho = toHex(a.data, i), hn = toHex(b.data, i)
        if (!allowed.has(hn)) foreign++
        const want = expect[ho]
        if (want === undefined) { unknownOld++; continue }
        if (want === hn) continue
        bad++
        diff.data.set([255, 0, 255, 255], i)
        const f = Math.floor(x / W), lx = x % W, bx = box[f] ?? (box[f] = [lx, y, lx, y])
        bx[0] = Math.min(bx[0], lx); bx[1] = Math.min(bx[1], y); bx[2] = Math.max(bx[2], lx); bx[3] = Math.max(bx[3], y)
      }
    const total = a.width * a.height
    const boxes = box.map((b, f) => (b ? `f${f}:[${b.join(",")}]` : null)).filter(Boolean)
    report.push(`${file}: ${frames} frame(s), ${bad} px differ (${((100 * bad) / total).toFixed(3)}%)` +
      (foreign ? `, ${foreign} px NOT night colours` : "") + (unknownOld ? `, ${unknownOld} v1 px not in ${legacy}` : "") +
      (boxes.length ? `\n    where: ${boxes.slice(0, 6).join(" ")}${boxes.length > 6 ? ` … (${boxes.length} frames)` : ""}` : ""))
    if (foreign || unknownOld) failed = true
    if (bad) fs.writeFileSync(path.join(OUT, file + "_diff.png"), PNG.sync.write(diff))
    if (kind === "scenes") {
      const ba = new PNG({ width: W * 2 + 8, height: a.height })
      for (let y = 0; y < a.height; y++) {
        a.data.copy(ba.data, (y * ba.width) * 4, y * a.width * 4, (y * a.width + W) * 4)
        b.data.copy(ba.data, (y * ba.width + W + 8) * 4, y * b.width * 4, (y * b.width + W) * 4)
      }
      fs.writeFileSync(path.join(OUT, name + "_before_after.png"), PNG.sync.write(ba))
    }
  }
  console.log(`${name} (${legacy} → night_base + ${accent})\n  ` + report.join("\n  "))
}
console.log("->", OUT)
process.exit(failed ? 1 : 0)
