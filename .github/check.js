// Checks index.html before it goes live. If anything is wrong, the site keeps
// the previous version and GitHub emails the person who saved the change.
// Run with --stamp to also write today's date into "Last updated".
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("index.html", "utf8");
const problems = [];

const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("No <script> block found in index.html."); process.exit(1); }
const script = m[1];

try { new vm.Script(script); }
catch (e) {
  console.error("index.html has a typo in the item list or script (often a missing quote or comma):");
  console.error("  " + e.message);
  process.exit(1);
}

// Evaluate only the data part: everything before the photo helper.
const data = script.split("/* Photos live")[0];
let ITEMS, CATS, T, UPDATED;
try { ({ITEMS, CATS, T, UPDATED} = vm.runInNewContext(data + ";({ITEMS, CATS, T, UPDATED})")); }
catch (e) { console.error("Could not read the item list: " + e.message); process.exit(1); }

const statuses = ["now", "later", "reserved", "sold"];
const cats = CATS.map(c => c[0]).filter(c => c !== "all");
const seen = new Set();
for (const it of ITEMS) {
  const who = `Item ${it.n ?? "?"}`;
  if (typeof it.n !== "number") problems.push(`${who}: n must be a number.`);
  if (seen.has(it.n)) problems.push(`${who}: number used twice.`);
  seen.add(it.n);
  if (!statuses.includes(it.st)) problems.push(`${who}: st is "${it.st}", must be one of ${statuses.join(", ")}.`);
  if (!cats.includes(it.cat)) problems.push(`${who}: cat is "${it.cat}", must be one of ${cats.join(", ")}.`);
  if (typeof it.price !== "number") problems.push(`${who}: price must be a plain number like 40 (no quotes, no €).`);
  if (!Array.isArray(it.img) || !it.img.length) problems.push(`${who}: needs at least one photo.`);
  else for (const id of it.img) if (!fs.existsSync(`img/${id}.jpg`)) problems.push(`${who}: photo img/${id}.jpg does not exist.`);
  for (const l of [].concat(it.link ?? [])) if (!/^https:\/\/\S+$/.test(typeof l === "string" ? l : l?.url)) problems.push(`${who}: link must start with https:// and have no spaces.`);
  for (const l of ["de", "en"]) if (!it[l] || typeof it[l].t !== "string" || typeof it[l].d !== "string")
    problems.push(`${who}: missing ${l} title or description.`);
}

if (problems.length) {
  console.error("Not published. Please fix:\n" + problems.map(p => "  - " + p).join("\n"));
  process.exit(1);
}
console.log(`OK: ${ITEMS.length} items checked.`);

if (process.argv.includes("--stamp")) {
  const d = new Date();
  const fmt = loc => d.toLocaleDateString(loc, {day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin"});
  const line = `const UPDATED = {de:"${fmt("de-DE")}", en:"${fmt("en-GB")}"};`;
  const build = `const BUILD = "${Date.now().toString(36)}";`;
  fs.writeFileSync("index.html", html.replace(/const UPDATED = \{[^}]*\};/, line).replace(/const BUILD = "[^"]*";/, build));
  console.log("Stamped: " + line);
}
