import { describe, expect, it } from "vitest";
import type { ShapeDefinition } from "../types/plugin.js";
import type { ShapeData } from "../types/shape.js";
import {
	containerAccepts,
	getContainerAttachHit,
	getContainerLayout,
	hasSelectableChildren,
	isContainerAutoAttach,
	isShapeContainer,
} from "../utils/container.js";

const shape = (overrides: Partial<ShapeData> = {}): ShapeData =>
	({
		id: "s",
		type: "x",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	}) as ShapeData;

const def = (container?: ShapeDefinition["container"]): ShapeDefinition =>
	({ container }) as ShapeDefinition;

describe("isShapeContainer", () => {
	it("is false when no container object", () => {
		expect(isShapeContainer(def(undefined), shape())).toBe(false);
		expect(isShapeContainer(undefined, shape())).toBe(false);
	});

	it("is true when container is present with no explicit enabled", () => {
		expect(isShapeContainer(def({}), shape())).toBe(true);
	});

	it("honors a boolean enabled", () => {
		expect(isShapeContainer(def({ enabled: false }), shape())).toBe(false);
		expect(isShapeContainer(def({ enabled: true }), shape())).toBe(true);
	});

	it("honors a per-instance predicate enabled", () => {
		const d = def({ enabled: (s) => s.meta?.component === "card" });
		expect(isShapeContainer(d, shape({ meta: { component: "card" } }))).toBe(true);
		expect(isShapeContainer(d, shape({ meta: { component: "button" } }))).toBe(false);
	});
});

describe("hasSelectableChildren", () => {
	it("is false for non-containers even if selectableChildren set", () => {
		expect(hasSelectableChildren(def({ enabled: false, selectableChildren: true }), shape())).toBe(
			false,
		);
	});

	it("defaults to false (group behavior) when omitted", () => {
		expect(hasSelectableChildren(def({}), shape())).toBe(false);
	});

	it("honors boolean and predicate forms", () => {
		expect(hasSelectableChildren(def({ selectableChildren: true }), shape())).toBe(true);
		const d = def({ selectableChildren: (s) => s.meta?.component === "card" });
		expect(hasSelectableChildren(d, shape({ meta: { component: "card" } }))).toBe(true);
		expect(hasSelectableChildren(d, shape({ meta: { component: "input" } }))).toBe(false);
	});
});

describe("isContainerAutoAttach", () => {
	it("is false by default and for non-containers", () => {
		expect(isContainerAutoAttach(def({}), shape())).toBe(false);
		expect(isContainerAutoAttach(def({ enabled: false, autoAttach: true }), shape())).toBe(false);
	});

	it("honors boolean and predicate forms", () => {
		expect(isContainerAutoAttach(def({ autoAttach: true }), shape())).toBe(true);
		const d = def({ autoAttach: (s) => s.meta?.component === "card" });
		expect(isContainerAutoAttach(d, shape({ meta: { component: "card" } }))).toBe(true);
		expect(isContainerAutoAttach(d, shape({ meta: { component: "x" } }))).toBe(false);
	});
});

describe("getContainerLayout", () => {
	it("returns the layout fn or undefined", () => {
		const layout = () => [];
		expect(getContainerLayout(def({ layout }))).toBe(layout);
		expect(getContainerLayout(def({}))).toBeUndefined();
		expect(getContainerLayout(undefined)).toBeUndefined();
	});
});

describe("getContainerAttachHit", () => {
	it("defaults to contain", () => {
		expect(getContainerAttachHit(def({ autoAttach: true }), shape())).toBe("contain");
		expect(getContainerAttachHit(undefined, shape())).toBe("contain");
	});
	it("honors the value and the predicate form", () => {
		expect(getContainerAttachHit(def({ attachHit: "center" }), shape())).toBe("center");
		const d = def({ attachHit: (s) => (s.meta?.snug ? "center" : "contain") });
		expect(getContainerAttachHit(d, shape({ meta: { snug: true } }))).toBe("center");
		expect(getContainerAttachHit(d, shape())).toBe("contain");
	});
});

describe("containerAccepts", () => {
	it("accepts everything without a filter", () => {
		expect(containerAccepts(def({ autoAttach: true }), shape(), shape({ id: "c" }))).toBe(true);
		expect(containerAccepts(undefined, shape(), shape({ id: "c" }))).toBe(true);
	});
	it("passes child and container to the filter", () => {
		const d = def({
			accepts: (child, container) => child.type === "card" && container.id === "slot",
		});
		expect(containerAccepts(d, shape({ id: "slot" }), shape({ id: "c", type: "card" }))).toBe(true);
		expect(containerAccepts(d, shape({ id: "slot" }), shape({ id: "c", type: "note" }))).toBe(
			false,
		);
	});
});
