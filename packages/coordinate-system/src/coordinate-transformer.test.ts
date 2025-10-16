import { describe, expect, it } from "vitest";
import { CoordinateTransformer } from "./coordinate-transformer";

describe("CoordinateTransformer", () => {
	describe("worldToScreen", () => {
		it("should transform world coordinates to screen coordinates with no offset", () => {
			const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 1 });
			const result = transformer.worldToScreen({ x: 100, y: 200 });

			expect(result).toEqual({ x: 100, y: 200 });
		});

		it("should apply camera offset", () => {
			const transformer = new CoordinateTransformer({ x: 50, y: 30, zoom: 1 });
			const result = transformer.worldToScreen({ x: 100, y: 200 });

			expect(result).toEqual({ x: 150, y: 230 });
		});

		it("should apply zoom", () => {
			const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 2 });
			const result = transformer.worldToScreen({ x: 100, y: 200 });

			expect(result).toEqual({ x: 200, y: 400 });
		});

		it("should apply both offset and zoom", () => {
			const transformer = new CoordinateTransformer({ x: 10, y: 20, zoom: 2 });
			const result = transformer.worldToScreen({ x: 100, y: 200 });

			expect(result).toEqual({ x: 210, y: 420 });
		});

		it("should handle negative coordinates", () => {
			const transformer = new CoordinateTransformer({ x: -10, y: -20, zoom: 1 });
			const result = transformer.worldToScreen({ x: -50, y: -100 });

			expect(result).toEqual({ x: -60, y: -120 });
		});

		it("should handle zoom less than 1", () => {
			const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 0.5 });
			const result = transformer.worldToScreen({ x: 100, y: 200 });

			expect(result).toEqual({ x: 50, y: 100 });
		});
	});

	describe("screenToWorld", () => {
		it("should transform screen coordinates to world coordinates with no offset", () => {
			const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 1 });
			const result = transformer.screenToWorld({ x: 100, y: 200 });

			expect(result).toEqual({ x: 100, y: 200 });
		});

		it("should apply camera offset", () => {
			const transformer = new CoordinateTransformer({ x: 50, y: 30, zoom: 1 });
			const result = transformer.screenToWorld({ x: 150, y: 230 });

			expect(result).toEqual({ x: 100, y: 200 });
		});

		it("should apply zoom", () => {
			const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 2 });
			const result = transformer.screenToWorld({ x: 200, y: 400 });

			expect(result).toEqual({ x: 100, y: 200 });
		});

		it("should apply both offset and zoom", () => {
			const transformer = new CoordinateTransformer({ x: 10, y: 20, zoom: 2 });
			const result = transformer.screenToWorld({ x: 210, y: 420 });

			expect(result).toEqual({ x: 100, y: 200 });
		});

		it("should be inverse of worldToScreen", () => {
			const transformer = new CoordinateTransformer({ x: 15, y: 25, zoom: 1.5 });
			const worldPoint = { x: 123, y: 456 };

			const screenPoint = transformer.worldToScreen(worldPoint);
			const backToWorld = transformer.screenToWorld(screenPoint);

			expect(backToWorld.x).toBeCloseTo(worldPoint.x);
			expect(backToWorld.y).toBeCloseTo(worldPoint.y);
		});
	});

	describe("transformBounds", () => {
		it("should transform bounds with no offset or zoom", () => {
			const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 1 });
			const result = transformer.transformBounds({
				x: 100,
				y: 200,
				width: 50,
				height: 30,
			});

			expect(result).toEqual({
				x: 100,
				y: 200,
				width: 50,
				height: 30,
			});
		});

		it("should apply camera offset to position", () => {
			const transformer = new CoordinateTransformer({ x: 10, y: 20, zoom: 1 });
			const result = transformer.transformBounds({
				x: 100,
				y: 200,
				width: 50,
				height: 30,
			});

			expect(result).toEqual({
				x: 110,
				y: 220,
				width: 50,
				height: 30,
			});
		});

		it("should apply zoom to size", () => {
			const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 2 });
			const result = transformer.transformBounds({
				x: 100,
				y: 200,
				width: 50,
				height: 30,
			});

			expect(result).toEqual({
				x: 200,
				y: 400,
				width: 100,
				height: 60,
			});
		});

		it("should apply both offset and zoom", () => {
			const transformer = new CoordinateTransformer({ x: 10, y: 20, zoom: 2 });
			const result = transformer.transformBounds({
				x: 100,
				y: 200,
				width: 50,
				height: 30,
			});

			expect(result).toEqual({
				x: 210,
				y: 420,
				width: 100,
				height: 60,
			});
		});
	});

	describe("toCSSTransform", () => {
		it("should generate CSS transform string", () => {
			const transformer = new CoordinateTransformer({ x: 10, y: 20, zoom: 1.5 });
			const result = transformer.toCSSTransform();

			expect(result).toBe("translate(10px, 20px) scale(1.5)");
		});

		it("should handle zero offset", () => {
			const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 2 });
			const result = transformer.toCSSTransform();

			expect(result).toBe("translate(0px, 0px) scale(2)");
		});

		it("should handle negative offset", () => {
			const transformer = new CoordinateTransformer({ x: -15, y: -25, zoom: 0.8 });
			const result = transformer.toCSSTransform();

			expect(result).toBe("translate(-15px, -25px) scale(0.8)");
		});
	});

	describe("getCamera", () => {
		it("should return camera state", () => {
			const camera = { x: 10, y: 20, zoom: 1.5 };
			const transformer = new CoordinateTransformer(camera);

			const result = transformer.getCamera();

			expect(result).toEqual(camera);
		});

		it("should return a copy of camera state", () => {
			const camera = { x: 10, y: 20, zoom: 1.5 };
			const transformer = new CoordinateTransformer(camera);

			const result = transformer.getCamera();
			result.x = 999; // 変更してもオリジナルに影響しない

			expect(transformer.getCamera()).toEqual(camera);
		});
	});

	describe("withCamera", () => {
		it("should create new transformer with different camera", () => {
			const transformer1 = new CoordinateTransformer({ x: 10, y: 20, zoom: 1 });
			const transformer2 = transformer1.withCamera({ x: 30, y: 40, zoom: 2 });

			expect(transformer1.getCamera()).toEqual({ x: 10, y: 20, zoom: 1 });
			expect(transformer2.getCamera()).toEqual({ x: 30, y: 40, zoom: 2 });
		});

		it("should not mutate original transformer", () => {
			const originalCamera = { x: 10, y: 20, zoom: 1 };
			const transformer = new CoordinateTransformer(originalCamera);

			transformer.withCamera({ x: 999, y: 999, zoom: 999 });

			expect(transformer.getCamera()).toEqual(originalCamera);
		});
	});
});
