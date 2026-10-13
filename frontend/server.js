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
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://code.jquery.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self' http://127.0.0.1:3000 http://localhost:3000; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
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
  if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const segments = relative.split(/[\\/]/);
  const extension = path.extname(relative).toLowerCase();
  if (segments.some(segment => segment.startsWith('.')) ||
      (extension && extension !== '.html' && !(segments[0] === 'assets' && ['.js', '.css'].includes(extension)))) {
    res.writeHead(403);
    return res.end();
  }
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

      fs.realpath(filePath, (realError, realPath) => {
      if (realError || !realPath.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
      res.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      if (req.method === "HEAD") return res.end();
      const stream = fs.createReadStream(realPath);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
      });
    });
  });
});

if (require.main === module) server.listen(port, "127.0.0.1", () => {
  console.log(`IntegraHub frontend: http://127.0.0.1:${port}`);
});
module.exports = server;
