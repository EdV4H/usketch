import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { loadExportPages } from "./plugin.js";

describe("loadExportPages", () => {
	it("ページを並び順で読み、名前とシェイプを揃える", async () => {
		const shape = { id: "a", type: "rect", x: 0, y: 0, width: 1, height: 1 } as ShapeData;
		const pages = await loadExportPages({
			list: () => [
				{ id: "p1", name: "一" },
				{ id: "p2", name: "二" },
			],
			loadShapes: async (id) => new Map(id === "p2" ? [["a", shape]] : []),
		});
		expect(pages.map((p) => [p.id, p.name, p.shapes.size])).toEqual([
			["p1", "一", 0],
			["p2", "二", 1],
		]);
	});
});
