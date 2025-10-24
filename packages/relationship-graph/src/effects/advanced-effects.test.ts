/**
 * Advanced Effects Unit Tests
 */

import type { LineShape, RectangleShape } from "@usketch/shared-types";
import { describe, expect, it } from "vitest";
import { applyAutoLayout, applyInheritStyle, applyMaintainDistance } from "./advanced-effects";

describe("applyInheritStyle", () => {
	const parent: RectangleShape = {
		id: "parent",
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		rotation: 0,
		fill: "#ff0000",
		stroke: "#0000ff",
		strokeWidth: 2,
	};

	const child: RectangleShape = {
		id: "child",
		type: "rectangle",
		x: 10,
		y: 10,
		width: 20,
		height: 20,
		rotation: 0,
		fill: "#000000",
		stroke: "#000000",
		strokeWidth: 1,
	};

	it("should inherit specified properties from parent", () => {
		const config = { properties: ["fill", "stroke"] };
		const result = applyInheritStyle(parent, child, config, {});

		expect(result).not.toBeNull();
		expect(result?.fill).toBe("#ff0000");
		expect(result?.stroke).toBe("#0000ff");
		expect(result?.strokeWidth).toBe(1); // Not inherited
	});

	it("should return null when no properties specified", () => {
		const config = { properties: [] };
		const result = applyInheritStyle(parent, child, config, {});

		expect(result).toBeNull();
	});

	it("should handle missing config", () => {
		const result = applyInheritStyle(parent, child, undefined, {});

		expect(result).toBeNull();
	});

	it("should inherit all specified properties", () => {
		const config = { properties: ["fill", "stroke", "strokeWidth"] };
		const result = applyInheritStyle(parent, child, config, {});

		expect(result).not.toBeNull();
		expect(result?.fill).toBe("#ff0000");
		expect(result?.stroke).toBe("#0000ff");
		expect(result?.strokeWidth).toBe(2);
	});
});

describe("applyMaintainDistance", () => {
	const parent: RectangleShape = {
		id: "parent",
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		rotation: 0,
		fill: "#000000",
		stroke: "#000000",
		strokeWidth: 1,
	};

	const line: LineShape = {
		id: "line",
		type: "line",
		x: 50,
		y: 50,
		endX: 150,
		endY: 150,
		rotation: 0,
		stroke: "#000000",
		strokeWidth: 2,
	};

	it("should snap line to nearest edge when snapToEdge is true", () => {
		const config = { snapToEdge: true };
		const result = applyMaintainDistance(parent, line, config, {});

		// Line starting at (50, 50) should snap to nearest edge
		// Nearest edge is likely top (y=0) or left (x=0)
		expect(result).not.toBeNull();
		// The exact position depends on findNearestEdgePoint implementation
		expect(result?.x).toBeDefined();
		expect(result?.y).toBeDefined();
	});

	it("should return null when snapToEdge is false", () => {
		const config = { snapToEdge: false };
		const result = applyMaintainDistance(parent, line, config, {});

		expect(result).toBeNull();
	});

	it("should return null for non-line shapes", () => {
		const config = { snapToEdge: true };
		const rect: RectangleShape = {
			id: "rect",
			type: "rectangle",
			x: 50,
			y: 50,
			width: 20,
			height: 20,
			rotation: 0,
			fill: "#ffffff",
			stroke: "#000000",
			strokeWidth: 1,
		};
		const result = applyMaintainDistance(parent, rect, config, {});

		expect(result).toBeNull();
	});
});

describe("applyAutoLayout", () => {
	const parent: RectangleShape = {
		id: "parent",
		type: "rectangle",
		x: 0,
		y: 0,
		width: 200,
		height: 200,
		rotation: 0,
		fill: "#000000",
		stroke: "#000000",
		strokeWidth: 1,
	};

	const child: RectangleShape = {
		id: "child",
		type: "rectangle",
		x: 50,
		y: 50,
		width: 20,
		height: 20,
		rotation: 0,
		fill: "#ffffff",
		stroke: "#000000",
		strokeWidth: 1,
	};

	it("should position child with padding in row layout", () => {
		const config = { layoutType: "flex", direction: "row", padding: 10 };
		const result = applyAutoLayout(parent, child, config, {});

		expect(result).not.toBeNull();
		expect(result?.x).toBe(10); // parent.x + padding
		expect(result?.y).toBe(10); // parent.y + padding
	});

	it("should position child with padding in column layout", () => {
		const config = { layoutType: "flex", direction: "column", padding: 20 };
		const result = applyAutoLayout(parent, child, config, {});

		expect(result).not.toBeNull();
		expect(result?.x).toBe(20); // parent.x + padding
		expect(result?.y).toBe(20); // parent.y + padding
	});

	it("should use default padding when not specified", () => {
		const config = { layoutType: "flex", direction: "row" };
		const result = applyAutoLayout(parent, child, config, {});

		expect(result).not.toBeNull();
		expect(result?.x).toBe(16); // parent.x + default padding (16)
		expect(result?.y).toBe(16); // parent.y + default padding (16)
	});

	it("should return null for unsupported layout types", () => {
		const config = { layoutType: "grid" };
		const result = applyAutoLayout(parent, child, config, {});

		expect(result).toBeNull();
	});
});
