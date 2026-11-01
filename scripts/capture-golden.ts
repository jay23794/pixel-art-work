// Renders the legacy reference frames into tests/golden/legacy/.
// Usage: npm run capture:golden  — overwrites the golden PNGs; only run when
// a task explicitly asks to update reference frames.
import { mkdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { GOLDEN_DIR, GOLDEN_FRAMES, goldenPath, openLegacyScene } from './legacy-render.ts';

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
