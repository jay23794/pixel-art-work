// npm run render -- <scene.json> [--out out/<name>.mp4] [--from N] [--to M]
import { basename, extname, relative } from 'node:path';
import { renderVideo } from './render.ts';

const USAGE = 'Usage: npm run render -- <scene.json> [--out out/<name>.mp4] [--from N] [--to M]   (frames inclusive)';

function parseArgs(argv: string[]): { scene: string; out: string; from?: number; to?: number } {
  let scene: string | undefined;
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--help' || a === '-h') {
      console.log(USAGE);
      process.exit(0);
    }
    if (a.startsWith('--')) {
      const value = argv[++i];
      if (!['--out', '--from', '--to'].includes(a)) throw new Error(`unknown option ${a}`);
      if (value === undefined || value.startsWith('--')) throw new Error(`${a} needs a value`);
      flags[a.slice(2)] = value;
    } else if (scene === undefined) scene = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if (!scene) throw new Error('missing scene file');
  const int = (name: string): number | undefined => {
    const v = flags[name];
    if (v === undefined) return undefined;
    if (!/^\d+$/.test(v)) throw new Error(`--${name} must be a non-negative integer, got "${v}"`);
    return Number(v);
  };
  const from = int('from');
  const to = int('to');
  return {
    scene,
    out: flags.out ?? `out/${basename(scene, extname(scene))}.mp4`,
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };
}

async function main(): Promise<void> {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`render: ${(e as Error).message}\n${USAGE}`);
    process.exit(2);
  }
  const tty = process.stdout.isTTY;
  const result = await renderVideo({
    ...args,
    onProgress: (done, total) => {
      if (tty && (done % 24 === 0 || done === total)) process.stdout.write(`\rframe ${done}/${total}`);
    },
  });
  if (tty) process.stdout.write('\n');
  const { timing: t, manifest: m } = result;
  const frames = m.to - m.from + 1;
  console.log(`rendered ${frames} frames (${m.from}–${m.to}) of ${m.scene}`);
  console.log(`  video     ${relative(process.cwd(), result.out)}`);
  console.log(`  hashes    ${relative(process.cwd(), result.manifestPath)}  (digest ${m.digest.slice(0, 16)}…)`);
  console.log(
    `  timing    ${t.msPerFrame.toFixed(1)} ms/frame (render + readback + encode) · frames ${(t.framesMs / 1000).toFixed(2)} s · setup ${(t.setupMs / 1000).toFixed(2)} s · finalize ${(t.finalizeMs / 1000).toFixed(2)} s · total ${(t.totalMs / 1000).toFixed(2)} s`,
  );
}

main().catch((e: unknown) => {
  console.error(`render failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
