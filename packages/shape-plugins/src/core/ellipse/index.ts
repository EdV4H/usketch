import { Ellipse } from "@usketch/react-shapes";
import type { ShapePlugin } from "@usketch/shape-registry";
import type { EllipseShape } from "@usketch/shared-types";

export const ellipsePlugin: ShapePlugin<EllipseShape> = {
	type: "ellipse",
	name: "Ellipse",
	component: Ellipse,

	createDefaultShape: ({ id, x, y }) => ({
		id,
		type: "ellipse",
		x,
		y,
		width: 100,
		height: 100,
		rotation: 0,
		opacity: 1,
		strokeColor: "#000000",
		fillColor: "#ffffff",
		strokeWidth: 2,
	}),

	getBounds: (shape) => ({
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	}),

	hitTest: (shape, point) => {
		// Ellipse equation: (x-h)²/a² + (y-k)²/b² ≤ 1
		const centerX = shape.x + shape.width / 2;
		const centerY = shape.y + shape.height / 2;
		const radiusX = shape.width / 2;
		const radiusY = shape.height / 2;

		const dx = point.x - centerX;
		const dy = point.y - centerY;

		return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1;
	},

	validate: (shape) => {
		return (
			shape.type === "ellipse" &&
			typeof shape.width === "number" &&
			typeof shape.height === "number" &&
			shape.width > 0 &&
			shape.height > 0
		);
	},

	serialize: (shape) => ({
		...shape,
	}),

	deserialize: (data) =>
		({
			...data,
			type: "ellipse",
		}) as EllipseShape,

	getResizeHandles: (shape) => [
		// Top
		{ x: shape.x + shape.width / 2, y: shape.y },
		// Right
		{ x: shape.x + shape.width, y: shape.y + shape.height / 2 },
		// Bottom
		{ x: shape.x + shape.width / 2, y: shape.y + shape.height },
		// Left
		{ x: shape.x, y: shape.y + shape.height / 2 },
		// Top-right
		{ x: shape.x + shape.width, y: shape.y },
		// Bottom-right
		{ x: shape.x + shape.width, y: shape.y + shape.height },
		// Bottom-left
		{ x: shape.x, y: shape.y + shape.height },
		// Top-left
		{ x: shape.x, y: shape.y },
	],

	getRotationHandle: (shape) => ({
		x: shape.x + shape.width / 2,
		y: shape.y - 30, // 30px above the shape
	}),
};
