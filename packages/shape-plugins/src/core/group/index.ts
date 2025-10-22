import { Group } from "@usketch/react-shapes";
import type { ShapePlugin } from "@usketch/shape-registry";
import type { GroupShape } from "@usketch/shared-types";
import { DEFAULT_SHAPE_STYLES } from "@usketch/shared-types";

export const groupPlugin: ShapePlugin<GroupShape> = {
	type: "group",
	name: "Group",
	component: Group,

	createDefaultShape: ({ id, x, y }) => ({
		id,
		type: "group",
		name: `Group ${id.substring(0, 4)}`,
		childIds: [],
		collapsed: false,
		x,
		y,
		width: 100,
		height: 100,
		rotation: 0,
		opacity: DEFAULT_SHAPE_STYLES.opacity,
		strokeColor: "transparent",
		fillColor: "transparent",
		strokeWidth: 0,
		layer: {
			visible: true,
			locked: false,
			zIndex: 0,
		},
	}),

	getBounds: (shape) => ({
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	}),

	hitTest: (shape, point) => {
		// Hit test on the bounding box
		return (
			point.x >= shape.x &&
			point.x <= shape.x + shape.width &&
			point.y >= shape.y &&
			point.y <= shape.y + shape.height
		);
	},

	validate: (shape) => {
		return (
			shape.type === "group" &&
			typeof shape.name === "string" &&
			Array.isArray(shape.childIds) &&
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
			type: "group",
		}) as GroupShape,

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
