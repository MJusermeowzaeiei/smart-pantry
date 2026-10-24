const { createRequire } = require("node:module");
const requireFromTools = createRequire("/tmp/icon-tools/package.json");
const sharp = requireFromTools("sharp");
const fs = require("node:fs/promises");
async function main() {
  const svg = await fs.readFile("icon-v2.svg");
  const maskable = await fs.readFile("icon-maskable-v2.svg");
  await Promise.all([
    sharp(svg).resize(180,180).png().toFile("icon-180-v2.png"),
    sharp(svg).resize(192,192).png().toFile("icon-192-v2.png"),
    sharp(svg).resize(512,512).png().toFile("icon-512-v2.png"),
    sharp(maskable).resize(512,512).png().toFile("icon-maskable-512-v2.png")
  ]);
  console.log("Generated 180, 192, 512 and maskable 512 PNG icons.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
