const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const root = __dirname;
const port = process.env.PORT || 5173;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = parsed.pathname || "/";

  if (pathname === "/") {
    pathname = "/popup.html";
  }

  const filePath = path.join(root, pathname);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".js"
        ? "text/javascript; charset=utf-8"
        : ext === ".css"
        ? "text/css; charset=utf-8"
        : "text/plain; charset=utf-8";

    res.setHeader("Content-Type", type);
    res.statusCode = 200;
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`[net-sniffer] Dev server listening on http://localhost:${port}`);
});

