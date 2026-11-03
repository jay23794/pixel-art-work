// Lab page: pick a study, tweak its params, scrub/play time, snapshot at 3×.
import { H, upscale, W } from './lib/buffer.ts';
import { renderStudy, resolveParams, type Study } from './render.ts';

const STUDIES = import.meta.glob<{ default: Study }>('./studies/*.ts');
const studyName = (path: string): string => path.replace(/^.*\/(.+)\.ts$/, '$1');
const FPS = 24;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const select = $<HTMLSelectElement>('study');
const view = $<HTMLCanvasElement>('view');
const overlay = $<HTMLCanvasElement>('overlay');
const paramsBox = $<HTMLDivElement>('params');
const scrub = $<HTMLInputElement>('scrub');
const timeLabel = $<HTMLSpanElement>('time');
const playBtn = $<HTMLButtonElement>('play');
const seedInput = $<HTMLInputElement>('seed');
const safe = $<HTMLInputElement>('safe');
const status = $<HTMLDivElement>('status');
const ctx = view.getContext('2d') as CanvasRenderingContext2D;
const image = ctx.createImageData(W, H);

let study: Study | undefined;
let name = '';
let params: Record<string, number> = {};
let t = 0;
let playing = false;
// Per-viewer convenience: remember the last study and scale.
const remember = (k: string, v: string): void => {
  try {
    localStorage.setItem(`lab.${k}`, v);
  } catch {
    /* storage unavailable */
  }
};
const recall = (k: string): string | null => {
  try {
    return localStorage.getItem(`lab.${k}`);
  } catch {
    return null;
  }
};

function draw(): void {
  if (!study) return;
  const seed = Math.trunc(Number(seedInput.value)) || 0;
  image.data.set(renderStudy(study, t, params, seed));
  ctx.putImageData(image, 0, 0);
  timeLabel.textContent = `${t.toFixed(2)} s`;
}

function setScale(s: number): void {
  for (const c of [view, overlay]) {
    c.style.width = `${W * s}px`;
    c.style.height = `${H * s}px`;
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('#scales button')) b.setAttribute('aria-pressed', String(Number(b.dataset.scale) === s));
  remember('scale', String(s));
}

function drawOverlay(): void {
  const o = overlay.getContext('2d') as CanvasRenderingContext2D;
  o.clearRect(0, 0, W, H);
  if (!safe.checked) return;
  o.fillStyle = 'rgba(255, 60, 90, 0.28)';
  o.fillRect(0, 0, W, 84);
  o.fillRect(0, H - 117, W, 117);
  o.fillStyle = 'rgba(255, 200, 60, 0.18)';
  o.fillRect(0, 84, 20, H - 201);
  o.fillRect(W - 20, 84, 20, H - 201);
}

function buildSliders(): void {
  paramsBox.replaceChildren();
  if (!study) return;
  for (const [key, s] of Object.entries(study.params)) {
    const label = document.createElement('label');
    label.className = 'param';
    const head = document.createElement('div');
    head.className = 'head';
    const title = document.createElement('span');
    title.textContent = key;
    const value = document.createElement('span');
    value.textContent = String(params[key]);
    head.append(title, value);
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: String(s.min), max: String(s.max), step: String(s.step), value: String(params[key]) });
    input.addEventListener('input', () => {
      params[key] = Number(input.value);
      value.textContent = input.value;
      draw();
    });
    label.append(head, input);
    paramsBox.append(label);
  }
}

async function load(n: string): Promise<void> {
  const loader = Object.entries(STUDIES).find(([p]) => studyName(p) === n)?.[1];
  if (!loader) return;
  study = (await loader()).default;
  name = n;
  params = resolveParams(study);
  scrub.max = String(study.duration ?? 10);
  t = 0;
  scrub.value = '0';
  buildSliders();
  draw();
  remember('study', n);
  const url = new URL(location.href);
  url.searchParams.set('study', n);
  history.replaceState(null, '', url);
}

// Play: advances t in whole frames, looping over the study's duration.
let last = 0;
function tick(now: number): void {
  if (!playing || !study) return;
  if (now - last >= 1000 / FPS) {
    last = now;
    const dur = study.duration ?? 10;
    t = Math.round(((t + 1 / FPS) % dur) * FPS) / FPS;
    scrub.value = String(t);
    draw();
  }
  requestAnimationFrame(tick);
}

playBtn.addEventListener('click', () => {
  playing = !playing;
  playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
  if (playing) requestAnimationFrame(tick);
});
scrub.addEventListener('input', () => {
  t = Math.round(Number(scrub.value) * FPS) / FPS;
  draw();
});
seedInput.addEventListener('input', draw);
safe.addEventListener('change', drawOverlay);
$<HTMLButtonElement>('reset').addEventListener('click', () => {
  if (!study) return;
  params = resolveParams(study);
  buildSliders();
  draw();
});
select.addEventListener('change', () => void load(select.value));

$<HTMLButtonElement>('snap').addEventListener('click', async () => {
  if (!study) return;
  status.textContent = 'Saving…';
  const big = upscale(renderStudy(study, t, params, Math.trunc(Number(seedInput.value)) || 0), W, H, 3);
  const c = document.createElement('canvas');
  c.width = W * 3;
  c.height = H * 3;
  (c.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(big as Uint8ClampedArray<ArrayBuffer>, W * 3, H * 3), 0, 0);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) {
    status.textContent = 'Could not encode PNG';
    return;
  }
  const res = await fetch(`/__lab/snapshot?study=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
  status.textContent = res.ok ? `Saved ${await res.text()}` : `Failed: ${await res.text()}`;
});

// Setup.
for (const s of [1, 2, 3]) {
  const b = document.createElement('button');
  b.textContent = `${s}×`;
  b.dataset.scale = String(s);
  b.addEventListener('click', () => setScale(s));
  $('scales').append(b);
}
const names = Object.keys(STUDIES).map(studyName).sort();
for (const n of names) select.append(new Option(n, n));
const wanted = new URLSearchParams(location.search).get('study') ?? recall('study') ?? 'hello';
const first = names.includes(wanted) ? wanted : (names[0] ?? '');
select.value = first;
setScale(Number(recall('scale')) || 2);
drawOverlay();
void load(first);
