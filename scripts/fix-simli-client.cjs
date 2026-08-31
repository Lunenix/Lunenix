/**
 * simli-client@3.0.2 ships dist/index.js with `require("./Client")` but the
 * file is named client.js. Linux (Vercel) is case-sensitive, so Next.js fails
 * with: Module not found: Can't resolve './Client'.
 *
 * Rewrite the barrel to the real filename, and copy Client.js as a fallback.
 */
const fs = require("fs");
const path = require("path");

const dist = path.join(
  __dirname,
  "..",
  "node_modules",
  "simli-client",
  "dist"
);

if (!fs.existsSync(dist)) {
  process.exit(0);
}

const indexJs = path.join(dist, "index.js");
if (fs.existsSync(indexJs)) {
  const next = fs
    .readFileSync(indexJs, "utf8")
    .replace(/require\(["']\.\/Client["']\)/g, 'require("./client")');
  fs.writeFileSync(indexJs, next);
}

const indexDts = path.join(dist, "index.d.ts");
if (fs.existsSync(indexDts)) {
  const next = fs
    .readFileSync(indexDts, "utf8")
    .replace(/['"]\.\/Client['"]/g, '"./client"');
  fs.writeFileSync(indexDts, next);
}

const pairs = [
  ["client.js", "Client.js"],
  ["client.d.ts", "Client.d.ts"],
  ["client.js.map", "Client.js.map"],
];

for (const [fromName, toName] of pairs) {
  const from = path.join(dist, fromName);
  const to = path.join(dist, toName);
  if (fs.existsSync(from) && !fs.existsSync(to)) {
    fs.copyFileSync(from, to);
  }
}
