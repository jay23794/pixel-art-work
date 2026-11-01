import { createScene } from './scene/factory.ts';
import { loadScene } from './scene/loader.ts';

declare global {
  interface Window {
    /** Resolves once the scene is built. */
    ready: Promise<boolean>;
    /** Renders frame n and returns it as a PNG data URL. */
    renderFrame: (n: number) => string;
  }
}

// Every scenes/*.json is available; pick one with ?scene=<file name>.
const SCENES = import.meta.glob<unknown>('../scenes/*.json', { import: 'default' });
const sceneName = (path: string): string => path.replace(/^.*\/(.+)\.json$/, '$1');

window.ready = (async () => {
  const params = new URLSearchParams(location.search);
  const names = Object.keys(SCENES).map(sceneName).sort();
  const name = params.get('scene') ?? names[0];
  const load = Object.entries(SCENES).find(([path]) => sceneName(path) === name)?.[1];
  if (!load) throw new Error(`scene "${name}" not found in scenes/ (available: ${names.join(', ')})`);

  const scene = await createScene(loadScene(await load(), `scenes/${name}.json`));
  document.body.appendChild(scene.canvas);
  window.renderFrame = (n) => {
    scene.renderFrame(n);
    return scene.canvas.toDataURL('image/png');
  };
  const frame = Number(params.get('frame') ?? 300);
  window.renderFrame(Number.isInteger(frame) && frame >= 0 ? frame : 300);
  return true;
})();
