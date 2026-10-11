// Lists every .js/.mjs/.cjs file that starts with a UTF-8 BOM: node tools/bom_check.js [root]   (default: repo root)
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || ".";
const skip = new Set(["node_modules", ".git", "dist", "out"]);
let total = 0;
const withBom = [];
(function walk(d)
{
  for (const e of fs.readdirSync(d, { withFileTypes: true }))
  {
    const p = path.join(d, e.name);
    if (e.isDirectory())
    {
      if (!skip.has(e.name)) walk(p);
    }
    else if (/\.(js|mjs|cjs)$/.test(p))
    {
      total++;
      const b = fs.readFileSync(p);
      if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) withBom.push(path.relative(root, p));
    }
  }
})(root);
console.log(`${withBom.length} of ${total} .js files have a BOM`);
withBom.forEach((p) => console.log(" ", p));
