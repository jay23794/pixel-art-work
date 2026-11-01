// Shape assets bundled with the app: assets/shapes/<id>.json, keyed by file name.
const files = import.meta.glob<unknown>('../../assets/shapes/*.json', { eager: true, import: 'default' });

export const BUNDLED_SHAPE_ASSETS: Readonly<Record<string, unknown>> = Object.fromEntries(
  Object.entries(files).map(([path, json]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), json]),
);
