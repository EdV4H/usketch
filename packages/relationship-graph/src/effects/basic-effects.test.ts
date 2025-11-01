/**
 * Basic Effects Unit Tests
 */

import type { RectangleShape, Shape } from "@usketch/shared-types";
import { describe, expect, it } from "vitest";
import {
	applyClipByParent,
	applyMoveWithParent,
	applyResizeWithParent,
	applyRotateWithParent,
} from "./basic-effects";

describe("applyMoveWithParent", () => {
	const parent: RectangleShape = {
		id: "parent",
		type: "rectangle",
		x: 100,
		y: 100,
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
		x: 150,
		y: 150,
		width: 50,
		height: 50,
		rotation: 0,
		fill: "#ffffff",
		stroke: "#000000",
		strokeWidth: 1,
	};

	it("should move child by deltaX and deltaY", () => {
		const config = { deltaX: 10, deltaY: 20 };
		const result = applyMoveWithParent(parent, child, config, {});

		expect(result).not.toBeNull();
		expect(result?.x).toBe(160);
		expect(result?.y).toBe(170);
	});

	it("should return null when delta is zero", () => {
		const config = { deltaX: 0, deltaY: 0 };
		const result = applyMoveWithParent(parent, child, config, {});

		expect(result).toBeNull();
	});

	it("should handle missing config", () => {
		const result = applyMoveWithParent(parent, child, undefined, {});

		expect(result).toBeNull();
	});
});

describe("applyRotateWithParent", () => {
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

	const child: RectangleShape = {
		id: "child",
		type: "rectangle",
		x: 50,
		y: 0,
		width: 20,
		height: 20,
		rotation: 0,
		fill: "#ffffff",
		stroke: "#000000",
		strokeWidth: 1,
	};

	it("should rotate child around parent center", () => {
		const config = { deltaRotation: Math.PI / 2 }; // 90度回転
		const result = applyRotateWithParent(parent, child, config, {});

		expect(result).not.toBeNull();
		// 親の中心は(50, 50)、子の中心は(60, 10)
		// 相対位置(10, -40)を90度回転すると(40, 10)
		// 新しい子の中心は(90, 60)、左上は(80, 50)
		expect(result?.x).toBeCloseTo(80, 0);
		expect(result?.y).toBeCloseTo(50, 0);
		expect(result?.rotation).toBeCloseTo(Math.PI / 2, 5);
	});

	it("should return null when deltaRotation is zero", () => {
		const config = { deltaRotation: 0 };
		const result = applyRotateWithParent(parent, child, config, {});

		expect(result).toBeNull();
	});
});

describe("applyResizeWithParent", () => {
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

	it("should scale child position and size", () => {
		const config = { scaleX: 2, scaleY: 2 };
		const result = applyResizeWithParent(parent, child, config, {});

		expect(result).not.toBeNull();
		expect(result?.x).toBe(100); // 0 + 50 * 2
		expect(result?.y).toBe(100); // 0 + 50 * 2
		expect(result?.width).toBe(40); // 20 * 2
		expect(result?.height).toBe(40); // 20 * 2
	});

	it("should return null when scale is 1", () => {
		const config = { scaleX: 1, scaleY: 1 };
		const result = applyResizeWithParent(parent, child, config, {});

		expect(result).toBeNull();
	});

	it("should handle asymmetric scaling", () => {
		const config = { scaleX: 2, scaleY: 1 };
		const result = applyResizeWithParent(parent, child, config, {});

		expect(result).not.toBeNull();
		expect(result?.x).toBe(100); // 0 + 50 * 2
		expect(result?.y).toBe(50); // 0 + 50 * 1
		expect(result?.width).toBe(40); // 20 * 2
		expect(result?.height).toBe(20); // 20 * 1
	});
});

describe("applyClipByParent", () => {
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

	it("should return null (handled at render time)", () => {
		const result = applyClipByParent(parent, child, undefined, {});

		expect(result).toBeNull();
	});
});
