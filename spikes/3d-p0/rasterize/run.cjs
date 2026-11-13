// P0(d): how long does it take to turn one shape into an image with the export path
// (`exportRegion`: Satori / SVG → PNG)? A GPU 3D renderer would need this per DOM shape
// (sticky, text, …) whenever it changes. Drives the dev web app (spike hook).
const { chromium } = require("playwright");
(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	page.on("pageerror", (e) => console.error("pageerror", e.message));
	await page.goto(`http://localhost:4578/local/spike-raster-${Date.now()}`);
	await page.waitForFunction(() => !!window.__spike3d && !!window.__spikeExport, null, { timeout: 60000 });
	const res = await page.evaluate(async () => {
		const ctx = window.__spike3d;
		const out = {};
		for (const type of ["rectangle", "ellipse", "sticky", "text", "markdown", "image", "card", "wireframe-card"]) {
			const def = ctx.shapes.get(type);
			if (!def) continue;
			const s = def.createDefault({ id: `r-${type}`, x: 0, y: 0 });
			ctx.store.addShape(s);
			const shape = ctx.store.getShape ? ctx.store.getShape(s.id) : s;
			const map = new Map([[s.id, shape ?? s]]);
			const rect = { x: s.x, y: s.y, width: s.width, height: s.height };
			const times = [];
			let err = null;
			for (let i = 0; i < 12; i++) {
				const t0 = performance.now();
				try {
					await window.__spikeExport(map, ctx.shapes, { rect, pixelRatio: 2, onShapeError: () => "placeholder" });
				} catch (e) {
					err = String(e).slice(0, 120);
					break;
				}
				times.push(performance.now() - t0);
			}
			times.sort((a, b) => a - b);
			out[type] = err ? { err } : { renderTarget: def.renderTarget ?? "svg", first: +times[times.length - 1].toFixed(1), median: +times[Math.floor(times.length / 2)].toFixed(1) };
		}
		return out;
	});
	console.log(JSON.stringify(res, null, 1));
	await browser.close();
})();
