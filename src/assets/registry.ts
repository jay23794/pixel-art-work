// Assets bundled with the app: assets/sprites/<id>.json and their images.
// Lazy (import.meta.glob only exists under Vite) so Node code can supply assets read from disk.
let defs: Readonly<Record<string, unknown>> | undefined;
let urls: Readonly<Record<string, string>> | undefined;

const fileName = (path: string): string => path.replace(/^.*\//, '');

/** Raw asset JSON by id (file name without .json). */
export function bundledAssets(): Readonly<Record<string, unknown>> {
  if (!defs) {
    const files = import.meta.glob<unknown>('../../assets/sprites/*.json', { eager: true, import: 'default' });
    defs = Object.fromEntries(Object.entries(files).map(([path, json]) => [fileName(path).replace(/\.json$/, ''), json]));
  }
  return defs;
}

/** Served URL of each bundled image, by file name. */
export function bundledAssetUrls(): Readonly<Record<string, string>> {
  if (!urls) {
    const files = import.meta.glob<string>('../../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });
    urls = Object.fromEntries(Object.entries(files).map(([path, url]) => [fileName(path), url]));
  }
  return urls;
}
