#!/usr/bin/env node
/**
 * Import data from design_handoff/design_files/js/data.js into Content Collections JSON.
 * Runs data.js in an isolated VM with a `window` stub and extracts USKETCH_DATA.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(__dirname, "..");
const HANDOFF_DATA = resolve(DOCS_ROOT, "_design_ref/design_files/js/data.js");
const CONTENT = resolve(DOCS_ROOT, "src/content");

const source = readFileSync(HANDOFF_DATA, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const data = sandbox.window.USKETCH_DATA;
if (!data) throw new Error("Failed to extract USKETCH_DATA from data.js");

const { PLUGINS, EXAMPLES, RELEASES, ROADMAP } = data;

function write(relative, value) {
	const target = resolve(CONTENT, relative);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, `${JSON.stringify(value, null, "\t")}\n`);
	console.log(`wrote ${relative} (${Array.isArray(value) ? value.length : 1} entries)`);
}

const plugins = PLUGINS.map((p) => ({
	id: p.id,
	name: p.name,
	category: p.cat,
	glyph: p.glyph,
	summary: p.desc,
	install: `pnpm add @edv4h/usketch-${p.id}`,
}));

const examples = EXAMPLES.map((e) => ({
	id: e.id,
	title: e.title,
	jpTitle: e.jp,
	kind: e.kind,
	tags: e.tags,
}));

const releases = RELEASES.map((r) => ({
	id: r.version,
	version: r.version,
	date: r.date,
	level: r.tag,
	highlights: r.items.map((it) => `${it.emoji} ${it.text}${it.desc}`),
}));

const roadmap = ROADMAP.map((p) => ({
	id: p.num.toLowerCase().replace(/\s+/g, "-"),
	phase: p.num,
	title: p.title,
	items: p.items,
}));

write("plugins/plugins.json", plugins);
write("examples/examples.json", examples);
write("releases/releases.json", releases);
write("roadmap/roadmap.json", roadmap);
