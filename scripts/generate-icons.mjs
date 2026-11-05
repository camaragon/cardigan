import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Keep the approved geometry and colors in docs/brand/logo-concepts unchanged.
const source = new URL("../docs/brand/logo-concepts/stitch/", import.meta.url);
const output = new URL("../public/", import.meta.url);
const assets = {
  "mark-light.svg": "logo.svg",
  "mark-dark.svg": "logo-dark.svg",
  "lockup-light.svg": "logo-lockup.svg",
  "lockup-dark.svg": "logo-lockup-dark.svg",
};
for (const [input, filename] of Object.entries(assets)) {
  await writeFile(
    new URL(filename, output),
    await readFile(new URL(input, source)),
  );
}

const mark = await readFile(new URL("mark-light.svg", source), "utf8");
const darkMark = await readFile(new URL("mark-dark.svg", source), "utf8");
// SVG favicons follow the browser's color scheme independently of page theme.
const paths = (svg) => svg.match(/<path\b[^>]*\/>/g).join("");
const favicon = mark.replace(
  /<path\b.*<\/svg>/s,
  `<style>
    .dark { display: none; }
    @media (prefers-color-scheme: dark) {
      .light { display: none; }
      .dark { display: inline; }
    }
  </style><g class="light">${paths(mark)}</g><g class="dark">${paths(darkMark)}</g></svg>`,
);
await writeFile(new URL("favicon.svg", output), favicon);

// Raster fallbacks use the light mark on white, readable on any browser chrome.
const raster = (size) =>
  sharp(Buffer.from(mark))
    .resize(size, size)
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
await writeFile(new URL("apple-touch-icon.png", output), await raster(180));

// ICO directory entries point to PNG images rendered from the same SVG source.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(raster));
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
