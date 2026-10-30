import type { ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { getNearestFrameAncestor } from "./frame-ancestor.js";

function shape(id: string, type: string, parentId?: string): ShapeData {
	return { id, type, x: 0, y: 0, width: 10, height: 10, parentId } as ShapeData;
}

function setup(list: ShapeData[], defs: Record<string, Pick<ShapeDefinition, "container">>) {
	const byId = new Map(list.map((s) => [s.id, s]));
	const store = { getShape: (id: string) => byId.get(id) };
	const shapes = { get: (type: string) => defs[type] as ShapeDefinition | undefined };
	return (id: string) => getNearestFrameAncestor(store, shapes, id);
}

const DEFS = {
	frame: { container: { selectableChildren: true, autoAttach: true } },
	"voice-frame": { container: { selectableChildren: true, autoAttach: false } },
	group: { container: {} },
	rect: {},
};

describe("getNearestFrameAncestor", () => {
	it("returns null for a top-level shape", () => {
		const find = setup([shape("a", "rect")], DEFS);
		expect(find("a")).toBeNull();
	});

	it("returns the parent frame", () => {
		const find = setup([shape("f", "frame"), shape("a", "rect", "f")], DEFS);
		expect(find("a")).toBe("f");
	});

	it("treats any container with selectable children as a frame, not just type 'frame'", () => {
		const find = setup([shape("v", "voice-frame"), shape("a", "rect", "v")], DEFS);
		expect(find("a")).toBe("v");
	});

	it("walks through a group to the frame that holds it", () => {
		const find = setup(
			[shape("f", "frame"), shape("g", "group", "f"), shape("a", "rect", "g")],
			DEFS,
		);
		expect(find("a")).toBe("f");
	});

	it("returns null when only group-style containers are above", () => {
		const find = setup([shape("g", "group"), shape("a", "rect", "g")], DEFS);
		expect(find("a")).toBeNull();
	});

	it("respects a per-instance container predicate", () => {
		const defs = {
			...DEFS,
			card: { container: { enabled: (d: ShapeData) => d.id === "on", selectableChildren: true } },
		};
		const find = setup(
			[
				shape("on", "card"),
				shape("off", "card"),
				shape("a", "rect", "on"),
				shape("b", "rect", "off"),
			],
			defs,
		);
		expect(find("a")).toBe("on");
		expect(find("b")).toBeNull();
	});

	it("stops on a parentId cycle", () => {
		const find = setup([shape("a", "rect", "b"), shape("b", "rect", "a")], DEFS);
		expect(find("a")).toBeNull();
	});
});
