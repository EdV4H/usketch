import type { ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { canEnterGroupEdit } from "../group-edit-state.js";

function makeShape(type: string, overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: `${type}-1`,
		type,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

const defs: Record<string, Pick<ShapeDefinition, "container">> = {
	group: { container: {} },
	frame: { container: { selectableChildren: true, autoAttach: true } },
	"voice-frame": { container: { selectableChildren: true, autoAttach: false } },
	card: { container: { enabled: (s) => s.meta?.component === "card" } },
	rectangle: {},
};
const shapes = { get: (type: string) => defs[type] as ShapeDefinition | undefined };

describe("canEnterGroupEdit", () => {
	it("enters any shape whose definition declares a container", () => {
		expect(canEnterGroupEdit(shapes, makeShape("group"))).toBe(true);
		expect(canEnterGroupEdit(shapes, makeShape("frame"))).toBe(true);
		expect(canEnterGroupEdit(shapes, makeShape("voice-frame"))).toBe(true);
	});

	it("honors a per-instance `container.enabled` predicate", () => {
		expect(canEnterGroupEdit(shapes, makeShape("card", { meta: { component: "card" } }))).toBe(
			true,
		);
		expect(canEnterGroupEdit(shapes, makeShape("card", { meta: { component: "button" } }))).toBe(
			false,
		);
	});

	it("does not enter non-containers, unregistered types, or a missing shape", () => {
		expect(canEnterGroupEdit(shapes, makeShape("rectangle"))).toBe(false);
		expect(canEnterGroupEdit(shapes, makeShape("unknown"))).toBe(false);
		expect(canEnterGroupEdit(shapes, undefined)).toBe(false);
	});
});
