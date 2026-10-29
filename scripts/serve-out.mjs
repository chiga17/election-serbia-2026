import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../out", import.meta.url)));
const port = Number(process.env.PORT) || 4317;
const host = "0.0.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function insideRoot(file) {
  return file === root || file.startsWith(root + sep);
}

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded.replace(/^\/+/, "");
  const file = resolve(root, rel);
  if (!insideRoot(file)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) {
    const index = join(file, "index.html");
    return existsSync(index) ? index : null;
  }
  if (existsSync(file)) return file;
  const html = `${file}.html`;
  if (existsSync(html)) return html;
  return null;
}

if (!existsSync(root)) {
  console.error("out/ is missing. Run npm run build first.");
  process.exit(1);
}

createServer((req, res) => {
  const file = resolveFile(req.url ?? "/");
  if (!file) {
    const notFound = join(root, "404.html");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end("Not found");
    return;
  }
  const type = types[extname(file)] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  createReadStream(file).pipe(res);
}).listen(port, host, () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}`);
});
