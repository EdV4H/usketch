// Bundle entry.ts with the real sources and run it in headless Chromium.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../..");
const esbuild = fs
	.readdirSync(path.join(root, "node_modules/.pnpm"))
	.filter((d) => d.startsWith("esbuild@0.27"))
	.map((d) => path.join(root, "node_modules/.pnpm", d, "node_modules/esbuild/bin/esbuild"))[0];
const layer = fs.readFileSync(path.join(root, "plugins/usketch-plugin-elevation/src/elevation-mesh-layer.tsx"), "utf8");
const depth = layer.match(/const DEPTH_RANGE = ([\d_]+);/)[1].replace(/_/g, "");
const vertex = layer
	.match(/const VERTEX = `([\s\S]*?)`;/)[1]
	.replace("${DEPTH_RANGE.toFixed(1)}", Number(depth).toFixed(1));
const out = path.join(__dirname, ".out.js");
execFileSync(esbuild, [path.join(__dirname, "entry.ts"), "--bundle", "--format=iife", `--outfile=${out}`, `--define:VERTEX_SOURCE=${JSON.stringify(vertex)}`, "--log-level=warning"]);
(async () => {
	const { chromium } = require("playwright");
	const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	page.on("pageerror", (e) => console.error("pageerror", e));
	await page.setContent("<!doctype html><body style='margin:0'></body>");
	await page.addScriptTag({ content: fs.readFileSync(out, "utf8") });
	const results = await page.evaluate(() => window.__results);
	console.log(JSON.stringify(results, null, 1));
	await browser.close();
})();
