// Renders the image files in public/ that cannot be written by hand:
//   og.png               1200x630 share card, from design/og.html
//   apple-touch-icon.png 180x180, the favicon on a square (iOS rounds it itself)
//   favicon.ico          48x48, for crawlers that ask for /favicon.ico regardless
//
// Run `npm run build` first (the browser helper starts the preview server),
// then `node design/render.mjs`. The outputs are committed; this only needs
// running when og.html or favicon.svg changes.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { openChrome } from '../test/chrome.mjs';

const { send } = await openChrome({ previewPort: 4351, cdpPort: 9351, profile: `render-${Date.now()}` });

async function shot(url, width, height, { transparent = false } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 600));
  const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
  return Buffer.from(res.result.data, 'base64');
}

const page = (body, bg) =>
  'data:text/html;charset=utf-8,' + encodeURIComponent(
    `<style>html,body{margin:0;height:100%;background:${bg}}svg{display:block;width:100%;height:100%}</style>${body}`);

const svg = readFileSync('public/favicon.svg', 'utf8');
// The touch icon is the same mark without its own rounded corners, slightly inset.
const glyph = svg.replace(/<rect[^>]*\/>/, '').replace('viewBox="0 0 32 32"', 'viewBox="-3 -3 38 38"');

writeFileSync('public/og.png', await shot(pathToFileURL('design/og.html').href, 1200, 630));
writeFileSync('public/apple-touch-icon.png', await shot(page(glyph, '#16181d'), 180, 180));

// An .ico may simply wrap a PNG: a 6-byte header, one 16-byte entry, the file.
const png = await shot(page(svg, 'transparent'), 48, 48, { transparent: true });
const head = Buffer.alloc(22);
head.writeUInt16LE(1, 2);            // type: icon
head.writeUInt16LE(1, 4);            // one image
head.writeUInt8(48, 6);              // width
head.writeUInt8(48, 7);              // height
head.writeUInt16LE(1, 10);           // colour planes
head.writeUInt16LE(32, 12);          // bits per pixel
head.writeUInt32LE(png.length, 14);  // size of the PNG
head.writeUInt32LE(22, 18);          // where it starts
writeFileSync('public/favicon.ico', Buffer.concat([head, png]));

console.log('wrote public/og.png, public/apple-touch-icon.png, public/favicon.ico');
process.exit(0);
