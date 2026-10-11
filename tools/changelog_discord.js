// Turns CHANGELOG.md's "### MD Markup Format" section into Discord messages and writes them into a
// "### Discord Messages" section at the end of the file (replacing any previous one), one ```md block per message,
// to paste one after another. Dry run (prints the messages) unless "write".
// Usage (repo root): node tools/changelog_discord.js [write] [limit]   (limit: characters per message, default 2000; 4000 with Nitro)
// - The first message starts with "## GridTracker2 v<version>" (from the topmost "## [v...]" heading)
// - "#### Area" headings become "### Area" (Discord renders only #, ## and ###)
// - Whole areas are packed into each message; an area too long for one message is split between its top-level
//   bullets and continues under "### Area (cont.)"
// - Discord formatting characters in the text (* _ ~ ` |) are escaped so they show as typed (and can't close a fence)
// The Discord Messages section must be the last part of the version section: it runs to the next "## [" heading.
const fs = require("fs");
const args = process.argv.slice(2);
const write = args.includes("write");
const limit = parseInt(args.find((x) => x !== "write") || "2000", 10);
const fail = (msg) =>
{
  console.log(msg + " - nothing written");
  process.exit(1);
};
if (!(limit >= 500)) fail("limit must be a number of at least 500");

const f = "CHANGELOG.md";
let s = fs.readFileSync(f, "utf8");
const nl = s.includes("\r\n") ? "\r\n" : "\n";
const version = (s.match(/^## \[v?([^\]]+)\]/m) || [])[1];
if (!version) fail("no ## [v...] version heading");
const mdHead = "### MD Markup Format" + nl;
const a = s.indexOf(mdHead);
if (a < 0 || s.indexOf(mdHead, a + 1) >= 0) fail("need exactly one ### MD Markup Format heading");
const afterMd = a + mdHead.length;
const mdNext = s.slice(afterMd).search(/^#{2,3} /m);
const md = s.slice(afterMd, mdNext < 0 ? s.length : afterMd + mdNext);

// Areas: { title, blocks: [top-level bullet with its sub-bullets, as text] }
const esc = (t) => t.replace(/([*_~`|\\])/g, "\\$1");
const areas = [];
for (const line of md.split(nl))
{
  if (line.trim() === "") continue;
  const h = line.match(/^#### (.*)$/);
  if (h)
  {
    areas.push({ title: esc(h[1]), blocks: [] });
    continue;
  }
  const li = line.match(/^( *)- (.*)$/);
  if (!li) fail("unexpected line: " + JSON.stringify(line));
  if (!areas.length) fail("bullet before the first #### heading: " + JSON.stringify(line));
  const area = areas[areas.length - 1];
  const text = li[1] + "- " + esc(li[2]);
  if (li[1] === "") area.blocks.push(text);
  else if (!area.blocks.length) fail("sub-bullet without a parent: " + JSON.stringify(line));
  else area.blocks[area.blocks.length - 1] += "\n" + text;
}
if (!areas.length) fail("no #### areas found");

// Messages are built with \n (their length is what Discord counts) and written with the file's line ending
const messages = [];
let current = `## GridTracker2 v${version}`;
const add = (chunk) =>
{
  const joined = current ? current + "\n\n" + chunk : chunk;
  if (joined.length > limit) return false;
  current = joined;
  return true;
};
const flush = () =>
{
  if (current) messages.push(current);
  current = "";
};
for (const area of areas)
{
  const whole = `### ${area.title}\n` + area.blocks.join("\n");
  if (add(whole)) continue;
  flush();
  if (add(whole)) continue;
  // Too long for one message: fill messages bullet by bullet
  let heading = `### ${area.title}`;
  let body = "";
  for (const block of area.blocks)
  {
    if ((heading + " (cont.)\n" + block).length > limit) fail(`a single bullet in "${area.title}" is longer than ${limit} characters`);
    if ((heading + "\n" + (body ? body + "\n" : "") + block).length <= limit)
    {
      body = body ? body + "\n" + block : block;
    }
    else
    {
      current = heading + "\n" + body;
      flush();
      heading = `### ${area.title} (cont.)`;
      body = block;
    }
  }
  current = heading + "\n" + body;
}
flush();

const section = messages.map((m, i) =>
  `Message ${i + 1} of ${messages.length} (${m.length} characters):` + nl + nl + "```md" + nl + m.split("\n").join(nl) + nl + "```"
).join(nl + nl);

if (!write)
{
  console.log(section.replace(/\r/g, ""));
  console.log(`dry run ok: ${messages.length} messages for v${version}, each at most ${limit} characters`);
  process.exit(0);
}

// Replace the existing Discord Messages section (to the next "## [" heading or the end), or add one at the end
const head = "### Discord Messages" + nl;
let start = s.indexOf(head);
if (start >= 0 && s.indexOf(head, start + 1) >= 0) fail("more than one ### Discord Messages heading");
let tail = "";
if (start >= 0)
{
  const after = start + head.length;
  const next = s.slice(after).search(/^## \[/m);
  const end = next < 0 ? s.length : after + next;
  const old = s.slice(after, end);
  // Only Message lines and ```md blocks may be in it, so nothing hand-written is lost
  const stripped = old.replace(/```md\r?\n[\s\S]*?\r?\n```/g, "").replace(/^Message \d+ of \d+ \(\d+ characters\):$/gm, "");
  if (stripped.trim() !== "") fail("### Discord Messages section holds something other than generated messages");
  tail = s.slice(end);
}
else
{
  if (/^## \[/m.test(s.slice(a))) fail("a ## [ heading follows the current version's MD section; add ### Discord Messages by hand where it belongs");
  s = s.replace(/(\r?\n)*$/, nl + nl);
  start = s.length;
}
s = s.slice(0, start) + head + nl + section + nl + (tail ? nl + tail : "");
fs.writeFileSync(f, s);
console.log(`written: ${messages.length} messages for v${version} (${messages.map((m) => m.length).join(", ")} characters)`);
