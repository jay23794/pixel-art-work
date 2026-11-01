// Renders the legacy reference frames (legacy/scene.html) into tests/golden/legacy/.
//
//   npm run capture:golden               writes the frames; refuses if any already exist
//   npm run capture:golden -- --update   overwrites existing frames
//
// Only use --update when a task explicitly asks to update reference frames.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { GOLDEN_DIR, GOLDEN_FRAMES, goldenPath } from './browser.ts';
import { openLegacyScene } from './legacy-render.ts';

const update = process.argv.includes('--update');
const existing = GOLDEN_FRAMES.map(goldenPath).filter((f) => existsSync(f));
if (existing.length && !update) {
  console.error(
    `Refusing to overwrite ${existing.length} existing golden frame(s):\n` +
      existing.map((f) => `  ${relative(process.cwd(), f)}`).join('\n') +
      '\nRe-run with --update to overwrite them (only when a new look is approved).',
  );
  process.exit(1);
}

await mkdir(GOLDEN_DIR, { recursive: true });
const scene = await openLegacyScene();
try {
  for (const n of GOLDEN_FRAMES) {
    const file = goldenPath(n);
    await writeFile(file, await scene.render(n));
    console.log(`frame ${n} -> ${relative(process.cwd(), file)}`);
  }
} finally {
  await scene.close();
}
