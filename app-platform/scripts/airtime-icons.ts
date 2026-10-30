/**
 * Builds Airtime glyphs from a game-icons.net checkout
 * (git clone --depth 1 https://github.com/game-icons/icons.git).
 *
 *   npx tsx scripts/airtime-icons.ts /path/to/game-icons
 *
 * Drops the black background square, leaves the glyph opaque (used as a CSS
 * mask and tinted with a design token), and rescales 512 → 64.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOAT_ICON, BOAT_ICONS, ITEM_ICONS, SAMPLE_ICONS, TANK_ICON, type IconSource } from "../lib/protocols/airtime/icon-credits";

const source = process.argv[2];
if (!source) {
  console.error("Usage: npx tsx scripts/airtime-icons.ts <game-icons checkout>");
  process.exit(1);
}

const outDir = join(__dirname, "..", "public", "protocols", "airtime");
mkdirSync(join(outDir, "items"), { recursive: true });
mkdirSync(join(outDir, "boats"), { recursive: true });

function convert(src: IconSource): string {
  const raw = readFileSync(join(source, src.author, `${src.icon}.svg`), "utf8");
  const inner = raw
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<path d="M0 0h512v512H0z"\/>/, "")
    .replace(/ fill="#fff"/g, "")
    .replace(/ fill-opacity="1"/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="scale(0.125)">${inner}</g></svg>\n`;
}

for (const [id, src] of Object.entries({ ...ITEM_ICONS, ...SAMPLE_ICONS })) {
  writeFileSync(join(outDir, "items", `${id}.svg`), convert(src));
}
for (const [id, src] of Object.entries(BOAT_ICONS)) {
  writeFileSync(join(outDir, "boats", `${id}.svg`), convert(src));
}
writeFileSync(join(outDir, "boat.svg"), convert(BOAT_ICON));
writeFileSync(join(outDir, "tank.svg"), convert(TANK_ICON));

console.log(
  `Wrote ${Object.keys(ITEM_ICONS).length} item icons, ${Object.keys(SAMPLE_ICONS).length} samples, ${Object.keys(BOAT_ICONS).length} boats, boat.svg, tank.svg to ${outDir}`
);
