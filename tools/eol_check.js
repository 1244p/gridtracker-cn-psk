// Line endings / BOM check: node tools/eol_check.js <file> [file ...]
// Project text files are CRLF with no BOM; prints "CRLF ok", "single line" or "MIXED/LF", plus "BOM!" if one is there
const fs = require("fs");
for (const f of process.argv.slice(2))
{
  const b = fs.readFileSync(f);
  const s = b.toString("utf8");
  const lf = (s.match(/\n/g) || []).length;
  const crlf = (s.match(/\r\n/g) || []).length;
  const bom = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
  console.log(`${f}: ${crlf && lf === crlf ? "CRLF ok" : lf === 0 ? "single line" : "MIXED/LF"}${bom ? " BOM!" : ""}`);
}
