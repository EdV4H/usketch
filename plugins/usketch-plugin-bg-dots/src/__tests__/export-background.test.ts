import type { Layer, PluginContext } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { DOT_RADIUS, DOT_SPACING, renderDotsExportBackground } from "../export-background.js";
import { createDotsBgPlugin } from "../plugin.js";

type Props = Record<string, unknown> & { children?: unknown };

/** Depth-first list of [type, props] for every element in the tree. */
function flatten(node: unknown): [string, Props][] {
	if (!node || typeof node !== "object") return [];
	if (Array.isArray(node)) return node.flatMap(flatten);
	const el = node as ReactElement<Props>;
	return [[String(el.type), el.props], ...flatten(el.props.children)];
}

const rect = { x: -15, y: 30, width: 120, height: 80 };

describe("renderDotsExportBackground", () => {
	it("ドットはボード座標固定（ズームで変わらない）で矩形を塗る", () => {
		const at1 = renderDotsExportBackground({ rect, zoom: 1, idPrefix: "p" });
		const at3 = renderDotsExportBackground({ rect, zoom: 3, idPrefix: "p" });
		expect(flatten(at3)).toEqual(flatten(at1));

		const els = flatten(at1);
		expect(els.find(([t]) => t === "pattern")?.[1]).toMatchObject({
			id: "p-pattern",
			x: 0,
			y: 0,
			width: DOT_SPACING,
			height: DOT_SPACING,
			patternUnits: "userSpaceOnUse",
		});
		expect(els.find(([t]) => t === "circle")?.[1]).toMatchObject({
			cx: DOT_SPACING / 2,
			cy: DOT_SPACING / 2,
			r: DOT_RADIUS,
		});
		const fill = els.find(([t, p]) => t === "rect" && p.fill === "url(#p-pattern)")?.[1];
		expect(fill).toMatchObject(rect);
	});
});

describe("createDotsBgPlugin の renderExportBackground", () => {
	it("bg:set に追従して表示中だけ描く（既定は非表示）", () => {
		let layer: Layer | undefined;
		const handlers = new Map<string, (p: unknown) => void>();
		const ctx = {
			layers: { register: (l: Layer) => (layer = l), unregister: () => {} },
			events: {
				on: (name: string, fn: (p: unknown) => void) => {
					handlers.set(name, fn);
					return () => {};
				},
			},
		} as unknown as PluginContext;
		createDotsBgPlugin().setup(ctx);

		const exportCtx = { rect, zoom: 1, idPrefix: "p" };
		expect(layer?.renderExportBackground?.(exportCtx)).toBeNull();
		handlers.get("bg:set")?.({ type: "dots" });
		expect(layer?.renderExportBackground?.(exportCtx)).not.toBeNull();
	});
});
