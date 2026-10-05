import type { Layer, PluginContext } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { GRID_SIZE, renderGridExportBackground } from "../export-background.js";
import { createGridBgPlugin } from "../plugin.js";

type Props = Record<string, unknown> & { children?: unknown };

/** Depth-first list of [type, props] for every element in the tree. */
function flatten(node: unknown): [string, Props][] {
	if (!node || typeof node !== "object") return [];
	if (Array.isArray(node)) return node.flatMap(flatten);
	const el = node as ReactElement<Props>;
	return [[String(el.type), el.props], ...flatten(el.props.children)];
}

const rect = { x: -15, y: 30, width: 120, height: 80 };

describe("renderGridExportBackground", () => {
	it("ボード座標の pattern で矩形を塗る（間隔はズーム非依存）", () => {
		const els = flatten(renderGridExportBackground({ rect, zoom: 1, idPrefix: "p" }));
		const pattern = els.find(([t]) => t === "pattern")?.[1];
		expect(pattern).toMatchObject({
			id: "p-pattern",
			x: 0,
			y: 0,
			width: GRID_SIZE,
			height: GRID_SIZE,
			patternUnits: "userSpaceOnUse",
		});
		const fill = els.find(([t, p]) => t === "rect" && p.fill === "url(#p-pattern)")?.[1];
		expect(fill).toMatchObject(rect);
	});

	it("線幅は画面 1px = 1/zoom ボード単位", () => {
		const strokeAt = (zoom: number) =>
			flatten(renderGridExportBackground({ rect, zoom, idPrefix: "p" })).find(
				([t]) => t === "path",
			)?.[1].strokeWidth;
		expect(strokeAt(1)).toBe(1);
		expect(strokeAt(2)).toBe(0.5);
		expect(strokeAt(0.5)).toBe(2);
	});
});

describe("createGridBgPlugin の renderExportBackground", () => {
	it("bg:set に追従して表示中だけ描く", () => {
		let layer: Layer | undefined;
		const handlers = new Map<string, (p: unknown) => void>();
		const ctx = {
			layers: { register: (l: Layer) => (layer = l), unregister: () => {} },
			events: {
				on: (name: string, fn: (p: unknown) => void) => {
					handlers.set(name, fn);
					return () => {};
				},
				emit: () => {},
			},
			actions: { register: () => () => {} },
		} as unknown as PluginContext;
		createGridBgPlugin().setup(ctx);

		const exportCtx = { rect, zoom: 1, idPrefix: "p" };
		expect(layer?.renderExportBackground?.(exportCtx)).not.toBeNull();
		handlers.get("bg:set")?.({ type: "dots" });
		expect(layer?.renderExportBackground?.(exportCtx)).toBeNull();
	});
});
