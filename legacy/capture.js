const { chromium } = require('playwright');
const fs = require('fs');
const [a, b] = [parseInt(process.argv[2]), parseInt(process.argv[3])];
const list = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 300, height: 500 } });
  page.on('console', m => console.log('page:', m.text()));
  page.on('pageerror', e => console.log('ERR:', e.message));
  await page.goto('file://' + __dirname + '/scene.html');
  await page.evaluate(() => window.ready);
  fs.mkdirSync(__dirname + '/frames', { recursive: true });
  const frames = list || Array.from({ length: b - a }, (_, i) => a + i);
  for (const n of frames) {
    const url = await page.evaluate(n => window.renderFrame(n), n);
    fs.writeFileSync(`${__dirname}/frames/f${String(n).padStart(4, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
})();
