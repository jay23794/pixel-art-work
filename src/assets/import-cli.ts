// npm run import -- <export.zip|folder|json> --id <id> [--palette file] [--scale auto|N] [--alpha 0-255]
//   [--no-trim] [--expect WxH] [--tags a,b] [--layer name] [--out assets/sprites] [--force]
import { relative } from 'node:path';
import { hex } from './cleanup.ts';
import { importFrameBaker, readPalette } from './importer.ts';

const USAGE =
  'Usage: npm run import -- <framebaker export (.zip, folder or .json)> --id <asset-id> [--palette <scene.json|palette.json>] [--scale auto|N] [--alpha 0-255] [--no-trim] [--expect WxH] [--tags a,b] [--layer name] [--out assets/sprites] [--force]';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--help' || a === '-h') return void console.log(USAGE);
    if (a === '--no-trim' || a === '--force') flags.set(a.slice(2), true);
    else if (a.startsWith('--')) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      flags.set(a.slice(2), v);
    } else positional.push(a);
  }
  const known = ['id', 'palette', 'scale', 'alpha', 'no-trim', 'expect', 'tags', 'layer', 'out', 'force'];
  for (const k of flags.keys()) if (!known.includes(k)) throw new Error(`unknown option --${k}`);
  const input = positional[0];
  const id = flags.get('id');
  if (!input || positional.length > 1) throw new Error('give exactly one export');
  if (typeof id !== 'string') throw new Error('--id is required');

  const str = (k: string): string | undefined => (typeof flags.get(k) === 'string' ? (flags.get(k) as string) : undefined);
  const scale = str('scale');
  const alpha = str('alpha');
  const expect = str('expect');
  const m = expect ? /^(\d+)x(\d+)$/.exec(expect) : null;
  if (expect && !m) throw new Error(`--expect must look like 21x47, got "${expect}"`);
  if (scale && scale !== 'auto' && !/^\d+$/.test(scale)) throw new Error(`--scale must be auto or a whole number, got "${scale}"`);
  if (alpha && (!/^\d+$/.test(alpha) || Number(alpha) > 255)) throw new Error(`--alpha must be 0-255, got "${alpha}"`);

  const r = await importFrameBaker(input, {
    id,
    ...(str('out') ? { outDir: str('out') as string } : {}),
    ...(str('palette') ? { palette: readPalette(str('palette') as string) } : {}),
    ...(scale ? { scale: scale === 'auto' ? 'auto' : Number(scale) } : {}),
    ...(alpha ? { alphaThreshold: Number(alpha) } : {}),
    ...(flags.has('no-trim') ? { trim: false } : {}),
    ...(m ? { expect: { width: Number(m[1]), height: Number(m[2]) } } : {}),
    ...(str('tags') ? { tags: (str('tags') as string).split(',').filter(Boolean) } : {}),
    ...(str('layer') ? { defaultLayer: str('layer') as string } : {}),
    force: flags.has('force'),
  });
  const a = r.asset, c = r.cleanup;
  console.log(`imported ${a.id}: ${a.type}, ${a.frames.length} frame(s) of ${a.width}×${a.height}${a.fps ? ` at ${a.fps} fps` : ''}, anchor (${a.anchor.x}, ${a.anchor.y})`);
  console.log(`  cleanup   scale ${c.scale}× → 1×, trimmed L${c.trimmed.left} T${c.trimmed.top} R${c.trimmed.right} B${c.trimmed.bottom}, ${c.colors.length} colours (${c.colors.slice(0, 6).map(hex).join(' ')}${c.colors.length > 6 ? ' …' : ''})`);
  console.log(`  wrote     ${relative(process.cwd(), r.png)}, ${relative(process.cwd(), r.json)}`);
  for (const w of r.warnings) console.log(`  warning   ${w}`);
}

main().catch((e: unknown) => {
  console.error(`import failed: ${e instanceof Error ? e.message : String(e)}\n${USAGE}`);
  process.exit(1);
});
