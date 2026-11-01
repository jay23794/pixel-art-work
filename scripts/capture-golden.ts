// Renders a golden frame set into tests/golden/<set>/.
//
//   npm run capture:golden -- <set>             writes the frames; refuses if any already exist
//   npm run capture:golden -- <set> --update    overwrites existing frames
//
// Sets: see GOLDEN_SCENES in scripts/golden.ts (v1 = desert-lab, laboratory = laboratory).
// Only use --update when a task explicitly asks to update reference frames.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { GOLDEN_FRAMES, GOLDEN_SCENES, goldenDir, goldenPath, type GoldenSet } from './golden.ts';
import { openScene } from './scene-render.ts';

const args = process.argv.slice(2);
const update = args.includes('--update');
const set = args.find((a) => !a.startsWith('--')) as GoldenSet | undefined;
if (!set || !(set in GOLDEN_SCENES)) {
  console.error(`Usage: npm run capture:golden -- <${Object.keys(GOLDEN_SCENES).join('|')}> [--update]`);
  process.exit(1);
}

const existing = GOLDEN_FRAMES.map((n) => goldenPath(n, set)).filter((f) => existsSync(f));
if (existing.length && !update) {
  console.error(
    `Refusing to overwrite ${existing.length} existing golden frame(s):\n` +
      existing.map((f) => `  ${relative(process.cwd(), f)}`).join('\n') +
      '\nRe-run with --update to overwrite them (only when a new look is approved).',
  );
  process.exit(1);
}

await mkdir(goldenDir(set), { recursive: true });
const scene = await openScene(GOLDEN_SCENES[set]);
try {
  for (const n of GOLDEN_FRAMES) {
    const file = goldenPath(n, set);
    await writeFile(file, await scene.render(n));
    console.log(`frame ${n} -> ${relative(process.cwd(), file)}`);
  }
} finally {
  await scene.close();
}
