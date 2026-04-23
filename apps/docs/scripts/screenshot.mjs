const { chromium } = await import(
	"/Users/yusukemaruyama/Projects/usketch/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs"
);
const base = process.env.BASE_URL ?? "http://localhost:4324/usketch";
const pages = [
	{ name: "home", path: "/" },
	{ name: "docs-intro", path: "/docs/getting-started/introduction/" },
	{ name: "plugins", path: "/plugins/" },
	{ name: "plugin-detail", path: "/plugins/ai-copilot/" },
	{ name: "examples", path: "/examples/" },
	{ name: "api", path: "/api/" },
	{ name: "changelog", path: "/changelog/" },
];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const p of pages) {
	const page = await ctx.newPage();
	await page.goto(`${base}${p.path}`, { waitUntil: "networkidle" });
	await page.screenshot({ path: `/tmp/usketch-screenshots/${p.name}.png`, fullPage: false });
	console.log("captured", p.name);
	await page.close();
}
await browser.close();
