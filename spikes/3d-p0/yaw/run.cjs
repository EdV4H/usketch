// P0(a): can Mode 7's yaw be folded into the viewport's rotation?
// Math: the tilt spins the flat stage about O = (W/2, H·horizon) before tipping it
// back, and the viewport maps world → flat stage as R(rot)·zoom·w + t. So
//   O + Rz(yaw)(R(rot)·zoom·w + t − O) = R(rot + yaw)·zoom·w + [O + Rz(yaw)(t − O)]
// i.e. yaw = Y with viewport (t, rot) should draw the same as yaw = 0 with viewport
// (O + Rz(Y)(t − O), rot + Y) — IF every tilted layer follows the viewport rotation.
// This drives the real web app (dev server on :4578, spike hook `__spike3d`), draws the
// same scene both ways and diffs the screenshots per layer.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const OUT = process.env.OUT ?? path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const W = 1280;
const H = 800;
const YAW = Number(process.env.YAW ?? 35);

(async () => {
	const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
	const page = await browser.newPage({ viewport: { width: W, height: H } });
	page.on("pageerror", (e) => console.error("pageerror", e.message));
	await page.goto(`http://localhost:4578/local/spike-yaw-${Date.now()}`);
	await page.waitForFunction(() => !!window.__spike3d, null, { timeout: 60000 });
	const setup = await page.evaluate(async () => {
		const ctx = window.__spike3d;
		const types = [...ctx.shapes.getAll().keys()];
		const add = (type, x, y, extra = {}) => {
			const def = ctx.shapes.get(type);
			if (!def) return null;
			const s = { ...def.createDefault({ id: `spike-${type}-${x}-${y}`, x, y }), ...extra };
			ctx.store.addShape(s);
			return s.id;
		};
		const made = [];
		for (let i = 0; i < 6; i++) {
			for (let j = 0; j < 4; j++) {
				const t = ["rectangle", "ellipse", "sticky", "text"][(i + j) % 4];
				made.push(add(t, i * 220, j * 200));
			}
		}
		// A stood sticky (shape-3d) and an elevation field (terrain + mesh).
		made.push(add("sticky", 300, -250, { "x-shape-3d": { mode: "stand", facing: "camera" } }));
		made.push(add("sticky", 640, -250, { "x-shape-3d": { mode: "stand", facing: "fixed" } }));
		made.push(add("rectangle", 960, -200, { "x-shape-3d": { mode: "box", height: 80 } }));
		const elev = ctx.services.get("usketch-plugin-elevation");
		if (elev) elev.enableInfinite();
		return { types, made: made.filter(Boolean).length, elevation: !!elev, layers: ctx.layers.getAll?.().map((l) => l.id) };
	});
	console.log("setup", JSON.stringify(setup));
	const mode7 = () => page.evaluate(() => window.__spike3d.services.get("usketch-plugin-mode7"));
	await page.evaluate(() => window.__spike3d.services.get("usketch-plugin-mode7").enable({ animate: false }));
	const settle = () => page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n > 20 ? r() : requestAnimationFrame(f)); f(); }));
	await page.waitForTimeout(1500);

	const shot = async (name, yaw, vp) => {
		await page.evaluate(({ yaw, vp }) => {
			const ctx = window.__spike3d;
			ctx.services.get("usketch-plugin-mode7").setYaw(yaw);
			ctx.store.setViewport(vp);
		}, { yaw, vp });
		await settle();
		await page.waitForTimeout(800);
		await settle();
		const file = path.join(OUT, `${name}.png`);
		await page.screenshot({ path: file });
		return file;
	};
	const cam = await page.evaluate(() => window.__spike3d.services.get("usketch-plugin-mode7").getState?.() ?? null);
	const horizon = await page.evaluate(() => {
		const v = window.__spike3d.services.get("usketch:view-3d");
		return v.camera().horizon;
	});
	const rect = await page.evaluate(() => {
		const el = document.querySelector("[data-layer-id='dom-shapes']");
		const stage = el?.parentElement?.getBoundingClientRect();
		return stage ? { left: stage.left, top: stage.top, width: stage.width, height: stage.height } : null;
	});
	console.log("stage", JSON.stringify(rect), "horizon", horizon);
	const O = { x: rect.width / 2, y: rect.height * horizon };
	const v0 = { x: 140, y: 380, zoom: 0.8, rotation: 0 };
	const r = (YAW * Math.PI) / 180;
	const dx = v0.x - O.x;
	const dy = v0.y - O.y;
	const v1 = { x: O.x + dx * Math.cos(r) - dy * Math.sin(r), y: O.y + dx * Math.sin(r) + dy * Math.cos(r), zoom: v0.zoom, rotation: YAW };

	// Isolate layers: hide everything but one layer id (or show all).
	const isolate = (id) =>
		page.evaluate((id) => {
			for (const el of document.querySelectorAll("[data-layer-id]")) {
				const keep = id === null || el.getAttribute("data-layer-id") === id;
				el.style.visibility = keep ? "" : "hidden";
			}
		}, id);
	const layerIds = await page.evaluate(() => [...new Set([...document.querySelectorAll("[data-layer-id]")].map((e) => e.getAttribute("data-layer-id")))]);
	const results = [];
	const only = process.env.LAYERS ? process.env.LAYERS.split(",") : null;
	for (const id of [null, ...layerIds].filter((l) => !only || only.includes(l ?? "all"))) {
		await isolate(id);
		const a = await shot(`${id ?? "all"}-yaw`, YAW, v0);
		const b = await shot(`${id ?? "all"}-rot`, 0, v1);
		const diff = await page.evaluate(async ({ a, b }) => {
			const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
			const [ia, ib] = await Promise.all([load(a), load(b)]);
			const c = document.createElement("canvas");
			c.width = ia.width; c.height = ia.height;
			const g = c.getContext("2d");
			g.drawImage(ia, 0, 0);
			const da = g.getImageData(0, 0, c.width, c.height).data;
			g.clearRect(0, 0, c.width, c.height);
			g.drawImage(ib, 0, 0);
			const db = g.getImageData(0, 0, c.width, c.height).data;
			let changed = 0;
			let sum = 0;
			for (let i = 0; i < da.length; i += 4) {
				const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
				sum += d;
				if (d > 48) changed++;
			}
			return { changedPct: (100 * changed) / (da.length / 4), meanAbs: sum / (da.length / 4) / 3 };
		}, { a: `data:image/png;base64,${fs.readFileSync(a).toString("base64")}`, b: `data:image/png;base64,${fs.readFileSync(b).toString("base64")}` });
		results.push({ layer: id ?? "(all)", ...diff });
		console.log(id ?? "(all)", JSON.stringify(diff));
	}
	fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ YAW, v0, v1, O, results }, null, 1));
	await browser.close();
})();
