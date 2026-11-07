// Night scene JSON → pxl study. Reads art/scenes/<file>.json, writes a wrapper study
// art/out/_scenes/<name>.px.js (the JSON + include("art/lib/night_scene.px.js") + nightScene()),
// loads it once to validate the JSON and print what the builder decided (closest recipe, rules
// applied), and prints the facts reel.sh needs. Format: art/scenes/README.md.
//
//   node art/scripts/scene.mjs <scene.json>                    → prints: name, cycle seconds, budget
//   node art/scripts/scene.mjs <scene.json> --compare <study>  → pixel-compares <name>, every frame of
//        <name>_loop and _<name>_loop_static with the same assets in art/studies/<study>.px.js
// Exit codes: 0 ok, 2 bad JSON / validation error, 6 compare found differences.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ART = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { loadProject } = await import(new URL("../../.claude/skills/pxl-pixel-art/src/index.ts", import.meta.url).href);

const args = process.argv.slice(2);
const ci = args.indexOf("--compare");
const compare = ci < 0 ? null : args.splice(ci, 2)[1];
const [jsonPath] = args;
if (!jsonPath) {
  console.error("usage: node art/scripts/scene.mjs <scene.json> [--compare <study>]");
  process.exit(2);
}

let text, spec;
try {
  text = readFileSync(jsonPath, "utf8");
} catch {
  console.error(`error: cannot read ${jsonPath}`);
  process.exit(2);
}
try {
  spec = JSON.parse(text);
} catch (e) {
  // Point at the line: JSON.parse reports a character position.
  const m = /position (\d+)/.exec(e.message);
  const at = m ? text.slice(0, +m[1]).split("\n").length : null;
  console.error(`error: ${jsonPath}${at ? ":" + at : ""}: not valid JSON (${e.message})`);
  process.exit(2);
}
const name = spec && typeof spec.name === "string" ? spec.name : basename(jsonPath, ".json");

// The wrapper: quiet (reel.sh builds it several times); a verbose twin prints the builder's log once.
const dir = join(ART, "out", "_scenes");
mkdirSync(dir, { recursive: true });
const wrapper = (verbose) =>
  `// Generated from ${jsonPath} by art/scripts/scene.mjs — edit the JSON, not this file.\n` +
  `var NIGHT_SCENE = ${JSON.stringify(spec, null, 2)}\n` +
  `include(${JSON.stringify(join(ART, "lib", "night_scene.px.js"))})\n` +
  `var NIGHT_SCENE_CFG = nightScene(NIGHT_SCENE, ${verbose})\n`;
const file = join(dir, `${name}.px.js`), verboseFile = join(dir, `_${name}.verbose.px.js`);
writeFileSync(file, wrapper(false));
writeFileSync(verboseFile, wrapper(true));

let p;
const said = [], log = console.log;
console.log = (...a) => { said.push(a.join(" ")); log(...a); }; // the builder logs through the sandbox's console
try {
  p = loadProject(verboseFile);
} catch (e) {
  console.log = log;
  console.error(`error: ${jsonPath}: ${String(e.message ?? e).replace(/^.*?night scene: /, "")}`);
  process.exit(2);
}
console.log = log;
const def = p.assets.get(`${spec.name}_loop`);
const frames = def.opts.frames, fps = def.opts.fps;
const [, budget, lo, hi] = /budget (\w+) \(([\d.]+)–([\d.]+)%\)/.exec(said.join("\n"));
const flash = /flash frames ([\d,]+) of/.exec(said.join("\n"))?.[1] ?? "-";
console.log(`scene ${spec.name} ${file} cycle ${frames / fps} budget ${budget} ${lo} ${hi} flash ${flash}`);

if (compare) {
  const study = loadProject(join(ART, "studies", `${compare}.px.js`));
  let bad = 0;
  for (const asset of [spec.name, `${spec.name}_loop`, `_${spec.name}_loop_static`]) { // same asset names in both
    const a = study.assets.get(asset), b = p.assets.get(asset);
    if (!a && !b) continue;
    if (!a || !b) { console.log(`compare ${asset}: missing in ${a ? "the JSON scene" : "the study"}`); bad++; continue; }
    const fa = a.kind === "anim" ? study.frames(asset) : [{ img: study.image(asset) }];
    const fb = a.kind === "anim" ? p.frames(asset) : [{ img: p.image(asset) }];
    if (fa.length !== fb.length) { console.log(`compare ${asset}: ${fa.length} vs ${fb.length} frames`); bad++; continue; }
    let diff = 0, first = null, frameDiffs = 0;
    fa.forEach((f, i) => {
      const da = f.img.data, db = fb[i].img.data;
      let d = 0;
      for (let k = 0; k < da.length; k++) if (da[k] !== db[k]) { d++; first ??= { x: k % 360, y: Math.floor(k / 360), frame: i }; }
      if (d) frameDiffs++;
      diff += d;
    });
    if (diff) bad++;
    console.log(`compare ${asset}: ${diff ? `${diff} pixels differ in ${frameDiffs}/${fa.length} frame(s), first at (${first.x}, ${first.y}) frame ${first.frame}` : `identical (${fa.length} frame${fa.length > 1 ? "s" : ""})`}`);
  }
  process.exit(bad ? 6 : 0);
}
