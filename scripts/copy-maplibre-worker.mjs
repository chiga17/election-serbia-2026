import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const to = join(root, "public/maplibre-gl-worker.mjs");

copyFileSync(from, to);
console.log(`copied maplibre worker to ${to}`);
