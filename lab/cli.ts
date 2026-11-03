// Headless lab renders, through the same Vite pipeline as the lab page.
//   npm run lab:snap -- <study> [--t 0] [--params '{}'] [--seed 1] [--out file.png]   → 3× PNG
//   npm run lab:loop -- <study> [--seconds 10] [--params '{}'] [--seed 1] [--out file.mp4]   → 1080×1920 MP4
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { createServer } from 'vite';
import { startEncoder } from '../src/video/ffmpeg.ts';
import { H, upscale, W } from './lib/buffer.ts';
import type { renderStudy as RenderStudy, resolveParams as ResolveParams, Study } from './render.ts';
import { OUT, stamp } from './vite.config.ts';

const LAB = dirname(fileURLToPath(import.meta.url));
const FPS = 24;
const SCALE = 3;
const USAGE = `Usage:
  npm run lab:snap -- <study> [--t 0] [--params '{"key":1}'] [--seed 1] [--out file.png]
  npm run lab:loop -- <study> [--seconds 10] [--params '{"key":1}'] [--seed 1] [--out file.mp4]`;

function parse(argv: string[]) {
  const [mode, study, ...rest] = argv;
  if (mode !== 'snap' && mode !== 'loop') throw new Error('mode must be snap or loop');
  if (!study || study.startsWith('--')) throw new Error('missing study name');
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as string;
    const v = rest[++i];
    if (!['--t', '--params', '--seed', '--out', '--seconds'].includes(a)) throw new Error(`unknown option ${a}`);
    if (v === undefined) throw new Error(`${a} needs a value`);
    flags[a.slice(2)] = v;
  }
  const num = (k: string, d: number): number => {
    const v = flags[k] === undefined ? d : Number(flags[k]);
    if (!Number.isFinite(v)) throw new Error(`--${k} must be a number, got "${flags[k]}"`);
    return v;
  };
  let params: Record<string, number>;
  try {
    params = JSON.parse(flags.params ?? '{}') as Record<string, number>;
  } catch {
    throw new Error(`--params must be JSON, got ${flags.params}`);
  }
  return { mode, study, t: num('t', 0), seconds: num('seconds', 10), seed: num('seed', 1), params, out: flags.out };
}

async function main(): Promise<void> {
  let args: ReturnType<typeof parse>;
  try {
    args = parse(process.argv.slice(2));
  } catch (e) {
    console.error(`lab: ${(e as Error).message}\n${USAGE}`);
    process.exit(2);
  }
  const server = await createServer({ configFile: join(LAB, 'vite.config.ts'), logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { renderStudy, resolveParams } = (await server.ssrLoadModule('/render.ts')) as { renderStudy: typeof RenderStudy; resolveParams: typeof ResolveParams };
    let study: Study;
    try {
      study = ((await server.ssrLoadModule(`/studies/${args.study}.ts`)) as { default: Study }).default;
    } catch (e) {
      throw new Error(`cannot load lab/studies/${args.study}.ts: ${(e as Error).message}`, { cause: e });
    }
    const params = resolveParams(study, args.params);
    mkdirSync(OUT, { recursive: true });

    if (args.mode === 'snap') {
      const file = resolve(args.out ?? join(OUT, `${args.study}-${stamp()}.png`));
      const png = new PNG({ width: W * SCALE, height: H * SCALE });
      png.data = Buffer.from(upscale(renderStudy(study, args.t, params, args.seed), W, H, SCALE));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, PNG.sync.write(png));
      console.log(`${relative(process.cwd(), file)}  (${W * SCALE}×${H * SCALE}, t=${args.t}s, seed ${args.seed}, ${JSON.stringify(params)})`);
    } else {
      const file = resolve(args.out ?? join(OUT, `${args.study}-${stamp()}.mp4`));
      const frames = Math.round(args.seconds * FPS);
      const enc = startEncoder({ width: W, height: H, fps: FPS, outputWidth: W * SCALE, outputHeight: H * SCALE, out: file });
      try {
        for (let n = 0; n < frames; n++) {
          await enc.write(Buffer.from(renderStudy(study, n / FPS, params, args.seed).buffer));
          if (process.stdout.isTTY && n % FPS === 0) process.stdout.write(`\rframe ${n}/${frames}`);
        }
        await enc.finish();
      } catch (e) {
        enc.abort();
        throw e;
      }
      if (process.stdout.isTTY) process.stdout.write('\n');
      console.log(`${relative(process.cwd(), file)}  (${W * SCALE}×${H * SCALE}, ${frames} frames at ${FPS} fps, seed ${args.seed}, ${JSON.stringify(params)})`);
    }
  } finally {
    await server.close();
  }
}

main().catch((e: unknown) => {
  console.error(`lab failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
