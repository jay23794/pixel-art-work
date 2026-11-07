// Builds one pxl asset, checks every pixel against its palette, and (optionally) writes a
// 24 fps PNG sequence of whole loops for ffmpeg. Used by reel.sh.
//
//   node frames.mjs <file.px.js> <asset> [--seconds N --dir OUT] [--first OUT.png] [--target name:lo:hi]
//
// Frames come from pxl's own build (Project.frames), the same pixels as the strip PNG / GIF it
// writes. Reading them here avoids GIF disposal quirks, and animated scenes only get a GIF.
// Static check: if the study defines a part `_<asset>_static` (same size), every opaque pixel of it
// marks a pixel that must be identical in every frame (moon, trunk, dunes...); any change fails.
// Motion budget (loops): the share of screen pixels that change from one frame to the next
// (last → first included), mean / min / max over the loop. Reported against the targets in
// art/CLAUDE.md (calm 0.1–2%, dramatic up to ~5%); never fails. Small values get more decimals so
// "0.00%" never hides real motion. See docs/night-notes.md (nightcity measured ~0.4%).
// Exit codes: 0 ok, 2 usage/build error, 3 palette check failed, 4 length not whole cycles,
// 5 static check failed.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PXL = new URL("../../.claude/skills/pxl-pixel-art/src/index.ts", import.meta.url);
const { loadProject, encodePng } = await import(PXL.href);

const OUT_FPS = 24;
const W = 360, H = 640;

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const seconds = opt("--seconds"), dir = opt("--dir"), first = opt("--first"), target = opt("--target");
const [file, asset] = args;
if (!file || !asset) {
  console.error("usage: node frames.mjs <file.px.js> <asset> [--seconds N --dir OUT] [--first OUT.png]");
  process.exit(2);
}

let p, frames, def;
try {
  p = loadProject(file);
  def = p.assets.get(asset);
  if (!def) throw new Error(`no asset '${asset}' in ${file} (have: ${p.exported().join(", ")})`);
  frames = p.frames(asset);
  if (!frames.length) frames = [{ img: p.image(asset), ms: 0 }];
} catch (e) {
  console.error(`error: ${e.message ?? e}`);
  process.exit(2);
}
const still = frames.length === 1 && frames[0].ms === 0;
const { w, h } = frames[0].img;
if (w !== W || h !== H) {
  console.error(`error: '${asset}' is ${w}×${h}; Phase 1 scenes are ${W}×${H}`);
  process.exit(2);
}

// ---------------------------------------------------------------- palette check
const hex = (c) => "#" + (c >>> 0).toString(16).padStart(8, "0").slice(0, 6);
const allowed = new Set([...def.pal.keys.values()].map((c) => c >>> 0));
const bad = new Map(); // hex -> { count, x, y, frame }
let badCount = 0;
frames.forEach((f, fi) => {
  const d = f.img.data;
  for (let i = 0; i < d.length; i++) {
    const c = d[i] >>> 0;
    if (allowed.has(c) && (c & 0xff) === 0xff) continue;
    badCount++;
    const k = (c & 0xff) === 0xff ? hex(c) : `${hex(c)} alpha ${c & 0xff}`;
    const b = bad.get(k);
    if (b) b.count++;
    else bad.set(k, { count: 1, x: i % w, y: Math.floor(i / w), frame: fi });
  }
});
const pixels = frames.length * w * h;
if (badCount) {
  console.error(`palette check FAILED: ${badCount} of ${pixels} pixels outside the ${allowed.size}-colour palette`);
  for (const [k, b] of [...bad].sort((a, b) => b[1].count - a[1].count).slice(0, 20))
    console.error(`  ${k}  ×${b.count}  first at (${b.x}, ${b.y})${frames.length > 1 ? ` frame ${b.frame}` : ""}`);
  if (bad.size > 20) console.error(`  … ${bad.size - 20} more colours`);
  process.exit(3);
}
const used = new Set();
for (const f of frames) for (const c of f.img.data) used.add(c >>> 0);
console.log(`palette check ok: ${frames.length} frame(s), ${used.size}/${allowed.size} palette colours used`);

// ---------------------------------------------------------------- static check
const maskName = `_${asset}_static`;
if (frames.length > 1 && p.assets.get(maskName)) {
  const mask = p.image(maskName);
  if (mask.w !== w || mask.h !== h) {
    console.error(`error: ${maskName} is ${mask.w}×${mask.h}, '${asset}' is ${w}×${h}`);
    process.exit(2);
  }
  const f0 = frames[0].img.data;
  let guarded = 0, moved = 0, firstAt = null;
  for (let i = 0; i < mask.data.length; i++) {
    if ((mask.data[i] & 0xff) === 0) continue; // transparent: free to move
    guarded++;
    for (let fi = 1; fi < frames.length; fi++)
      if (frames[fi].img.data[i] !== f0[i]) {
        moved++;
        firstAt ??= { x: i % w, y: Math.floor(i / w), frame: fi };
        break;
      }
  }
  if (moved) {
    console.error(`static check FAILED: ${moved} of ${guarded} pixels in ${maskName} change ` +
      `(first at (${firstAt.x}, ${firstAt.y}) in frame ${firstAt.frame})`);
    process.exit(5);
  }
  console.log(`static check ok: ${guarded} pixels in ${maskName} identical in all ${frames.length} frames`);
}

// ---------------------------------------------------------------- motion budget
const MOTION_CALM = [0.1, 2], MOTION_DRAMATIC = 5; // % of the screen changing per frame
// 2 decimals from 1%, 4 below 0.1%: a few moving pixels still show.
const pctFmt = (v) => (v === 0 ? "0" : v.toFixed(v >= 1 ? 2 : v >= 0.1 ? 3 : 4)) + "%";
if (frames.length > 1) {
  const pct = frames.map((f, fi) => {
    const a = f.img.data, b = frames[(fi + 1) % frames.length].img.data;
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return (100 * n) / a.length;
  });
  const mean = pct.reduce((s, v) => s + v, 0) / pct.length, max = Math.max(...pct), min = Math.min(...pct);
  const verdict = mean < MOTION_CALM[0] ? "below calm (subtle; fine if intended)"
    : mean <= MOTION_CALM[1] ? "calm" : mean <= MOTION_DRAMATIC ? "dramatic (waves, storms)" : "above dramatic (busy)";
  console.log(`motion budget: ${pctFmt(mean)} of pixels change per frame (min ${pctFmt(min)}, max ${pctFmt(max)}); ` +
    `calm ${MOTION_CALM[0]}–${MOTION_CALM[1]}%, dramatic ≤ ~${MOTION_DRAMATIC}%: ${verdict}`);
  // --target name:lo:hi[:flash] (night scenes from JSON: motion.budget): the scene's own target.
  // Lightning flash frames (comma list) are reported apart: the budget is judged without them.
  if (target) {
    const [tn, lo, hi, fl] = target.split(":"), l = Number(lo), h = Number(hi);
    const flash = new Set(fl && fl !== "-" ? fl.split(",").map(Number) : []);
    let m = mean;
    if (flash.size) {
      const touch = (fi) => flash.has(fi) || flash.has((fi + 1) % pct.length);
      const rest = pct.filter((_, fi) => !touch(fi)), hit = pct.filter((_, fi) => touch(fi));
      m = rest.reduce((s, v) => s + v, 0) / rest.length;
      console.log(`motion budget without lightning: ${pctFmt(m)} (${rest.length} frame steps); flash steps (frames ${[...flash].join(",")}): ` +
        `mean ${pctFmt(hit.reduce((s, v) => s + v, 0) / hit.length)}, max ${pctFmt(Math.max(...hit))}`);
    }
    console.log(`motion target ${tn} ${l}–${h}%${flash.size ? " (without lightning)" : ""}: ${m < l ? "BELOW (too still for " + tn + ")" : m > h ? "ABOVE (too busy for " + tn + ")" : "inside"}`);
  }
}

if (first) writeFileSync(first, encodePng(frames[0].img));

// ---------------------------------------------------------------- 24 fps sequence
if (seconds !== undefined) {
  const secs = Number(seconds);
  if (!dir || !(secs > 0)) {
    console.error("error: --seconds needs a positive number and --dir");
    process.exit(2);
  }
  const n = frames.length;
  // Nominal fps: the anim's own, else what pxl's (rounded) frame duration implies.
  const fps = def.opts.fps ?? (still ? OUT_FPS : Math.round(1000 / frames[0].ms));
  const cycle = still ? 0 : n / fps;
  if (!still) {
    const cycles = (secs * fps) / n;
    if (Math.abs(cycles - Math.round(cycles)) > 1e-9) {
      console.error(`error: ${secs} s is not a whole number of ${cycle} s cycles (${n} frames at ${fps} fps); ` +
        `use a multiple of ${cycle} s`);
      process.exit(4);
    }
  }
  // Map output time onto pxl's frame durations, scaled so one pxl loop = exactly n / fps s.
  const loopMs = frames.reduce((a, f) => a + f.ms, 0);
  const starts = [];
  frames.reduce((t, f) => (starts.push(t), t + f.ms), 0);
  const pngs = frames.map((f) => encodePng(f.img));
  mkdirSync(dir, { recursive: true });
  const total = Math.round(secs * OUT_FPS);
  for (let j = 0; j < total; j++) {
    let k = 0;
    if (!still) {
      const t = (((j / OUT_FPS) % cycle) / cycle) * loopMs;
      while (k + 1 < n && starts[k + 1] <= t + 1e-6) k++;
    }
    writeFileSync(join(dir, String(j).padStart(5, "0") + ".png"), pngs[k]);
  }
  console.log(still
    ? `sequence: still image held for ${secs} s (${total} frames at ${OUT_FPS} fps)`
    : `sequence: ${n} frames at ${fps} fps = ${cycle} s cycle × ${Math.round((secs * fps) / n)} = ${secs} s (${total} frames at ${OUT_FPS} fps)`);
}
