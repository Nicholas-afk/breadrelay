import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
export async function serve(port = 4173, base = "/breadrelay/") {
  const root = fileURLToPath(new URL("../dist/", import.meta.url));
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
  };
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (!pathname.startsWith(base)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const relative =
      decodeURIComponent(pathname.slice(base.length)) || "index.html";
    const path = resolve(root, relative);
    if (!path.startsWith(root) || relative.includes("..")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    try {
      const data = await readFile(path);
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((done) => server.listen(port, "127.0.0.1", done));
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await serve();
  console.log("BreadRelay preview: http://127.0.0.1:4173/breadrelay/");
}
