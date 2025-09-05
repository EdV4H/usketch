import { Rectangle } from "@usketch/react-shapes";
import type { ShapePlugin } from "@usketch/shape-registry";
import type { RectangleShape } from "@usketch/shared-types";

export const rectanglePlugin: ShapePlugin<RectangleShape> = {
	type: "rectangle",
	name: "Rectangle",
	component: Rectangle,

	createDefaultShape: ({ id, x, y }) => ({
		id,
		type: "rectangle",
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
		// Simple AABB (Axis-Aligned Bounding Box) test
		return (
			point.x >= shape.x &&
			point.x <= shape.x + shape.width &&
			point.y >= shape.y &&
			point.y <= shape.y + shape.height
		);
	},

	validate: (shape) => {
		return (
			shape.type === "rectangle" &&
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
			type: "rectangle",
		}) as RectangleShape,

	getResizeHandles: (shape) => [
		// Top-left
		{ x: shape.x, y: shape.y },
		// Top-right
		{ x: shape.x + shape.width, y: shape.y },
		// Bottom-right
		{ x: shape.x + shape.width, y: shape.y + shape.height },
		// Bottom-left
		{ x: shape.x, y: shape.y + shape.height },
		// Top-center
		{ x: shape.x + shape.width / 2, y: shape.y },
		// Right-center
		{ x: shape.x + shape.width, y: shape.y + shape.height / 2 },
		// Bottom-center
		{ x: shape.x + shape.width / 2, y: shape.y + shape.height },
		// Left-center
		{ x: shape.x, y: shape.y + shape.height / 2 },
	],

	getRotationHandle: (shape) => ({
		x: shape.x + shape.width / 2,
		y: shape.y - 30, // 30px above the shape
	}),
};
