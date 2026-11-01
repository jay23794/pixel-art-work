// Shape assets bundled with the app: assets/shapes/<id>.json, keyed by file name.
// Lazy so Node code (e.g. the export CLI) can import the loader and pass assets read from disk.
let bundled: Readonly<Record<string, unknown>> | undefined;

export function bundledShapeAssets(): Readonly<Record<string, unknown>> {
  if (!bundled) {
    const files = import.meta.glob<unknown>('../../assets/shapes/*.json', { eager: true, import: 'default' });
    bundled = Object.fromEntries(Object.entries(files).map(([path, json]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), json]));
  }
  return bundled;
}
