import { describe, expect, it, vi } from "vitest";
import { parseFreedrawConfig } from "../config.js";
import { createFreedrawApi } from "../freedraw-service.js";
import { penMeta } from "../pen-meta.js";
import { createFreedrawSettingsStore } from "../settings-store.js";

const makeApi = () => {
	const settings = createFreedrawSettingsStore(parseFreedrawConfig({ persistSettings: false }));
	return { settings, api: createFreedrawApi(settings) };
};

describe("createFreedrawApi の getSettings / onSettingsChange", () => {
	it("今のペン・色・太さを返す（太さは未設定ならペンの既定）", () => {
		const { api, settings } = makeApi();
		const s = settings.getSnapshot();
		expect(api.getSettings()).toEqual({
			mode: "pen",
			pen: s.pen,
			color: s.color,
			size: penMeta(s.pen).defaultSize,
			eraserSize: s.eraserSize,
		});
	});

	it("ペンと太さを変えると、そのペンの太さを返す", () => {
		const { api, settings } = makeApi();
		settings.update({ pen: "brush", sizes: { brush: 12 } });
		expect(api.getSettings()).toMatchObject({ pen: "brush", size: 12 });
	});

	it("消しゴム中でも size はペンの太さ", () => {
		const { api, settings } = makeApi();
		settings.update({ pen: "felt", sizes: { felt: 9 }, eraserSize: 30, mode: "eraser" });
		expect(api.getSettings()).toMatchObject({ mode: "eraser", size: 9, eraserSize: 30 });
	});

	it("変わったら呼び、解除したら呼ばない", () => {
		const { api, settings } = makeApi();
		const listener = vi.fn();
		const off = api.onSettingsChange(listener);
		settings.update({ color: "#ff0000" });
		expect(listener).toHaveBeenCalledTimes(1);
		off();
		settings.update({ color: "#00ff00" });
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
