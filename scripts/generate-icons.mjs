import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// The public mark and outlined lockups are the approved logo sources.
const output = new URL("../public/", import.meta.url);
const mark = await readFile(new URL("logo.svg", output), "utf8");
const paths = mark.match(/<g\b.*<\/g>/s)[0];
const svg = (content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${content}</svg>`;
const smallMark = (size) =>
  paths
    .replace('stroke-width="5.5"', `stroke-width="${size === 16 ? 7.5 : size === 32 ? 7 : 5.5}"`);
const faviconTile = (content) =>
  `<rect width="48" height="48" rx="10.5" fill="#FFFFFF"/><g transform="translate(6.75 6.75) scale(0.71875)">${content}</g>`;

// SVG image media queries use the rendered viewport, including favicon size.
await writeFile(
  new URL("favicon.svg", output),
  svg(`<style>
    g { stroke-width: 5.5; }
    @media (max-width: 40px) { g { stroke-width: 7; } }
    @media (max-width: 16px) {
      g { stroke-width: 7.5; }
    }
  </style>${faviconTile(smallMark(48))}`),
);

// iOS supplies the icon mask; keep the source square and opaque.
await writeFile(
  new URL("apple-touch-icon.png", output),
  await sharp(Buffer.from(svg(
    `<path fill="#FFFFFF" d="M0 0H48V48H0Z"/><g transform="translate(6.75 6.75) scale(0.71875)">${paths}</g>`,
  )))
    .resize(180, 180)
    .png()
    .toBuffer(),
);

// ICO directory entries point to PNG images, with size-specific strokes.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) =>
  sharp(Buffer.from(svg(faviconTile(smallMark(size))))).resize(size, size).png().toBuffer(),
));
const directory = Buffer.alloc(6 + 16 * sizes.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [index, image] of images.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
}
await writeFile(
  new URL("favicon.ico", output),
  Buffer.concat([directory, ...images]),
);
