const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.FRONTEND_PORT || 5500);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = path.resolve(root, relative);
  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end();
  }

  fs.stat(filePath, (error, stats) => {
    if (error) {
      res.writeHead(404);
      return res.end();
    }

    if (stats.isDirectory()) filePath = path.join(filePath, "index.html");
    fs.stat(filePath, (fileError, fileStats) => {
      if (fileError || !fileStats.isFile()) {
        res.writeHead(404);
        return res.end();
      }

      res.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(filePath).pipe(res);
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`IntegraHub frontend: http://127.0.0.1:${port}`);
});
