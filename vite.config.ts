import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

/**
 * legacy/scene.html loads `pixi.min.js` from its own folder. Instead of
 * vendoring a copy, serve the npm pixi.js v8 browser build at that URL so the
 * legacy file stays byte-for-byte unchanged.
 */
function legacyPixi(): Plugin {
  // dist/ isn't in pixi.js's package exports, so locate it from the main entry.
  const pixiMin = join(dirname(require.resolve('pixi.js')), '..', 'dist', 'pixi.min.js');
  return {
    name: 'legacy-pixi',
    configureServer(server) {
      server.middlewares.use('/legacy/pixi.min.js', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript');
        createReadStream(pixiMin).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [legacyPixi()],
  // Pre-bundle up front so the first page load never triggers a dependency reload.
  optimizeDeps: { include: ['pixi.js'] },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
