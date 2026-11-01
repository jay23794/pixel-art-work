// Node only: FrameBaker spritesheet export → asset (assets/sprites/<id>.png + <id>.json).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { z } from 'zod';
import { assetSchema, type AssetDef } from './contract.ts';
import { cleanupFrames, crop, hex, packRow, readPng, writePng, type CleanupOptions, type CleanupResult } from './cleanup.ts';
import { readZip } from './zip.ts';

/** The JSON FrameBaker writes next to its spritesheet (`<name>.frames.json`). */
export const frameBakerSchema = z.object({
  frames: z.array(z.object({ file: z.string(), x: z.number().int(), y: z.number().int(), w: z.number().int().positive(), h: z.number().int().positive(), duration: z.number().int().positive() })).min(1),
  meta: z.object({
    app: z.literal('FrameBaker'),
    format: z.literal('spritesheet'),
    fps: z.number().positive(),
    cellWidth: z.number().int().positive(),
    cellHeight: z.number().int().positive(),
    /** Shared local origin of all frames, in cell pixels. */
    originX: z.number(),
    originY: z.number(),
    axisName: z.string().optional(),
  }),
});
export type FrameBakerExport = z.infer<typeof frameBakerSchema>;

export interface ImportOptions extends CleanupOptions {
  /** Asset id (lowercase, digits, "-"). */
  readonly id: string;
  /** Output folder. Default assets/sprites. */
  readonly outDir?: string;
  readonly tags?: readonly string[];
  readonly defaultLayer?: string;
  /** Overwrite an existing asset with the same id. */
  readonly force?: boolean;
}

export interface ImportResult {
  readonly asset: AssetDef;
  readonly json: string;
  readonly png: string;
  readonly cleanup: CleanupResult;
  readonly warnings: readonly string[];
}

/** Reads an export: a .zip, a folder, or the .json / .png of an extracted export. */
export function readFrameBakerExport(input: string): { meta: FrameBakerExport; sheet: Buffer; name: string } {
  if (!existsSync(input)) throw new Error(`export not found: ${input}`);
  const readDir = (dir: string, only?: string): Map<string, Buffer> =>
    new Map(
      readdirSync(dir)
        .filter((f) => (f.endsWith('.json') || f.endsWith('.png')) && statSync(join(dir, f)).isFile())
        .filter((f) => !only || f === only || f.endsWith('.png'))
        .map((f) => [f, readFileSync(join(dir, f))]),
    );
  let files: Map<string, Buffer>;
  if (statSync(input).isDirectory()) files = readDir(input);
  else if (extname(input).toLowerCase() === '.zip') files = readZip(readFileSync(input));
  else if (extname(input).toLowerCase() === '.json') files = readDir(dirname(input), basename(input));
  else throw new Error(`expected a FrameBaker export .zip, folder or .json, got ${input}`);

  const jsons = [...files.keys()].filter((f) => f.endsWith('.json'));
  const jsonName = jsons.find((f) => f.endsWith('.frames.json')) ?? (jsons.length === 1 ? jsons[0] : undefined);
  if (!jsonName) throw new Error(`no FrameBaker frames JSON in ${input} (found: ${[...files.keys()].join(', ') || 'nothing'})`);
  let raw: unknown;
  try {
    raw = JSON.parse((files.get(jsonName) as Buffer).toString('utf8'));
  } catch (e) {
    throw new Error(`${jsonName} is not valid JSON`, { cause: e });
  }
  const parsed = frameBakerSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`${jsonName} is not a FrameBaker spritesheet export:\n${parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  const sheetName = parsed.data.frames[0]?.file as string;
  const sheet = files.get(sheetName) ?? files.get(sheetName.replace(/\.png$/, '.spritesheet.png'));
  if (!sheet) throw new Error(`spritesheet ${sheetName} not found next to ${jsonName}`);
  return { meta: parsed.data, sheet, name: basename(jsonName).replace(/(\.frames)?\.json$/, '') };
}

/** Imports a FrameBaker export as an asset: crop cells, clean up, pack in one row, write PNG + JSON. */
export async function importFrameBaker(input: string, options: ImportOptions): Promise<ImportResult> {
  const outDir = options.outDir ?? 'assets/sprites';
  const json = join(outDir, `${options.id}.json`);
  const png = join(outDir, `${options.id}.png`);
  if (!options.force && (existsSync(json) || existsSync(png))) throw new Error(`asset "${options.id}" already exists in ${outDir} (use --force to overwrite)`);

  const { meta } = readFrameBakerExport(input);
  const sheet = await readPng(readFrameBakerExport(input).sheet);
  const cells = meta.frames.map((f, i) => {
    if (f.w !== meta.meta.cellWidth || f.h !== meta.meta.cellHeight) throw new Error(`frame ${i} is ${f.w}×${f.h}, expected the cell size ${meta.meta.cellWidth}×${meta.meta.cellHeight}`);
    return crop(sheet, f.x, f.y, f.w, f.h);
  });
  const cleanup = cleanupFrames(cells, { x: meta.meta.originX, y: meta.meta.originY }, options);

  const warnings: string[] = [];
  const anchor = { x: Math.round(cleanup.anchor.x), y: Math.round(cleanup.anchor.y) };
  if (anchor.x !== cleanup.anchor.x || anchor.y !== cleanup.anchor.y) warnings.push(`anchor (${cleanup.anchor.x}, ${cleanup.anchor.y}) rounded to whole pixels (${anchor.x}, ${anchor.y})`);
  const animated = cleanup.frames.length > 1;
  const asset = assetSchema.parse({
    id: options.id,
    type: animated ? 'animation' : 'sprite',
    src: `${options.id}.png`,
    width: cleanup.width,
    height: cleanup.height,
    anchor,
    frames: cleanup.frames.map((_, i) => ({ x: i * cleanup.width, y: 0, duration: meta.frames[i]?.duration ?? 1 })),
    ...(animated ? { fps: meta.meta.fps } : {}),
    ...(options.defaultLayer === undefined ? {} : { defaultLayer: options.defaultLayer }),
    tags: [...(options.tags ?? [])],
    palette: cleanup.colors.map(hex),
  });

  await mkdir(outDir, { recursive: true });
  await writePng(png, packRow(cleanup.frames));
  await writeFile(json, `${JSON.stringify(asset, null, 2)}\n`);
  return { asset, json, png, cleanup, warnings };
}

/** Colours from a palette file: a scene JSON (its `palette`), { colors: [...] }, or an array of "#rrggbb". */
export function readPalette(file: string): number[] {
  const j = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  const list = Array.isArray(j) ? j : (j as { colors?: unknown; palette?: unknown }).colors ?? Object.values(((j as { palette?: Record<string, unknown> }).palette ?? {}) as Record<string, unknown>);
  const colors = (list as unknown[]).map((c) => {
    if (typeof c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error(`${file}: palette entries must be "#rrggbb", got ${JSON.stringify(c)}`);
    return parseInt(c.slice(1), 16);
  });
  if (colors.length === 0) throw new Error(`${file}: no palette colours found`);
  return colors;
}
