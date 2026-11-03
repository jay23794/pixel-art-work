import { mkdirSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const LAB = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(LAB, '..');
export const OUT = join(ROOT, 'out', 'lab');

/** "2026-11-03T14-05-09" (local file names, not drawing code). */
export const stamp = (): string => new Date().toISOString().slice(0, 19).replace(/:/g, '-');

/** POST /__lab/snapshot?study=<name> with a PNG body → out/lab/<name>-<timestamp>.png. */
function snapshots(): Plugin {
  return {
    name: 'lab-snapshot',
    configureServer(server) {
      server.middlewares.use('/__lab/snapshot', (req: IncomingMessage, res: ServerResponse) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const study = new URL(req.url ?? '', 'http://x').searchParams.get('study') ?? '';
          if (req.method !== 'POST' || !/^[\w-]+$/.test(study)) {
            res.statusCode = 400;
            return res.end('POST /__lab/snapshot?study=<name> with a PNG body');
          }
          mkdirSync(OUT, { recursive: true });
          const file = join(OUT, `${study}-${stamp()}.png`);
          writeFileSync(file, Buffer.concat(chunks));
          res.end(relative(ROOT, file));
        });
      });
    },
  };
}

export default defineConfig({
  root: LAB,
  plugins: [snapshots()],
  server: { fs: { allow: [ROOT] } },
});
