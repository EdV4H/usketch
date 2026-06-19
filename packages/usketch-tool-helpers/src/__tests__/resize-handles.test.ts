import type { ShapeData, ShapeDefinition, Viewport } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { findHandleAtScreenPoint } from "../internal/resize-handles.js";
import { createTestToolContext, makeShape } from "./test-helpers.js";

const VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

function rectLikeDef(type: string, resizable?: boolean): ShapeDefinition {
	return {
		type,
		minSize: { width: 1, height: 1 },
		...(resizable === undefined ? {} : { resizable }),
		hitTest: (data: ShapeData, point: { x: number; y: number }) =>
			point.x >= data.x &&
			point.x <= data.x + data.width &&
			point.y >= data.y &&
			point.y <= data.y + data.height,
		getBounds: (data: ShapeData) => ({
			x: data.x,
			y: data.y,
			width: data.width,
			height: data.height,
		}),
		render: () => null,
	} as unknown as ShapeDefinition;
}

describe("findHandleAtScreenPoint", () => {
	it("returns the SE handle when the cursor is on a resizable shape's corner", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.setSelection(["a"]);
		// SE corner of a 100x100 shape at origin, zoom 1 → screen (100, 100).
		const hit = findHandleAtScreenPoint({ x: 100, y: 100 }, ctx.shapes, ctx.store, VIEWPORT);
		expect(hit).toEqual({ shapeId: "a", handle: "se" });
	});

	it("returns null for a shape whose definition declares resizable: false", () => {
		const ctx = createTestToolContext();
		ctx.shapes.register("fixed", rectLikeDef("fixed", false));
		ctx.store.addShape(makeShape({ id: "a", type: "fixed", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.setSelection(["a"]);
		// Same corner that would hit for a resizable shape — must be ignored.
		const hit = findHandleAtScreenPoint({ x: 100, y: 100 }, ctx.shapes, ctx.store, VIEWPORT);
		expect(hit).toBeNull();
	});

	it("still returns a handle when resizable is omitted (defaults to resizable)", () => {
		const ctx = createTestToolContext();
		ctx.shapes.register("plain", rectLikeDef("plain"));
		ctx.store.addShape(makeShape({ id: "a", type: "plain", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.setSelection(["a"]);
		const hit = findHandleAtScreenPoint({ x: 100, y: 100 }, ctx.shapes, ctx.store, VIEWPORT);
		expect(hit).toEqual({ shapeId: "a", handle: "se" });
	});

	it("honors the predicate form of resizable per shape instance", () => {
		const ctx = createTestToolContext();
		// resizable depends on the shape: those tagged meta.locked are not resizable.
		const def = rectLikeDef("dynamic");
		(def as { resizable: (s: ShapeData) => boolean }).resizable = (s) =>
			(s.meta as { locked?: boolean } | undefined)?.locked !== true;
		ctx.shapes.register("dynamic", def);

		ctx.store.addShape(
			makeShape({ id: "free", type: "dynamic", x: 0, y: 0, width: 100, height: 100 }),
		);
		ctx.store.setSelection(["free"]);
		expect(findHandleAtScreenPoint({ x: 100, y: 100 }, ctx.shapes, ctx.store, VIEWPORT)).toEqual({
			shapeId: "free",
			handle: "se",
		});

		ctx.store.deleteShape("free");
		ctx.store.addShape(
			makeShape({
				id: "locked",
				type: "dynamic",
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				meta: { locked: true },
			}),
		);
		ctx.store.setSelection(["locked"]);
		expect(findHandleAtScreenPoint({ x: 100, y: 100 }, ctx.shapes, ctx.store, VIEWPORT)).toBeNull();
	});
});
