import { createDesertLab } from './scenes/desertLab.ts';

declare global {
  interface Window {
    /** Resolves once the scene is built. */
    ready: Promise<boolean>;
    /** Renders frame n and returns it as a PNG data URL. */
    renderFrame: (n: number) => string;
  }
}

window.ready = (async () => {
  const scene = await createDesertLab();
  document.body.appendChild(scene.canvas);
  window.renderFrame = (n) => {
    scene.renderFrame(n);
    return scene.canvas.toDataURL('image/png');
  };
  const frame = Number(new URLSearchParams(location.search).get('frame') ?? 300);
  window.renderFrame(Number.isInteger(frame) && frame >= 0 ? frame : 300);
  return true;
})();
