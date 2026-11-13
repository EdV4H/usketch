// Runs bench.html in headless Chromium: the probe (is a character behind a sign hidden?)
// and frame times. Headless uses software rendering, so absolute ms are not a real GPU's;
// compare the two modes with each other. Open bench.html in Safari / Chrome for real numbers.
const { chromium } = require("playwright");
const path = require("node:path");
(async () => {
	const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
	const page = await browser.newPage({ viewport: { width: 1280, height: 848 } });
	await page.goto(`file://${path.join(__dirname, "bench.html")}`);
	for (const mode of ["separate", "merged"]) {
		await page.evaluate((m) => window.runOne(m, 60), mode);
		await page.evaluate(() => { window.yaw = 0; });
		await page.screenshot({ path: path.join(__dirname, `out-${mode}.png`) });
	}
	const r = await page.evaluate(() => window.runAll());
	console.log(JSON.stringify(r.results.map((x) => ({ mode: x.mode, n: x.n, correct: x.probe.correct, top: x.probe.topmostAtCharacter, ...x.frameMs }))));
	await browser.close();
})();
