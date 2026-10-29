import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = readFileSync(join(root, "src/data/elections.json"), "utf8");
const template = readFileSync(join(root, "scripts/offline-template.html"), "utf8");
const safe = data
  .replace(/</g, "\\u003c")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");
if (!template.includes("__ELECTION_DATA__")) {
  throw new Error("offline template is missing the data placeholder");
}
const html = template.replace("__ELECTION_DATA__", safe);
const out = join(root, "public/Shpilkin-Serbia.html");
writeFileSync(out, html);
console.log(`wrote ${out} (${html.length.toLocaleString("en-GB")} bytes)`);
