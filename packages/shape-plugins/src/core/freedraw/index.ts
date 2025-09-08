import { Freedraw } from "@usketch/react-shapes";
import type { ShapePlugin } from "@usketch/shape-registry";
import type { FreedrawShape } from "@usketch/shared-types";
import { DEFAULT_FREEDRAW_STYLES } from "@usketch/shared-types";

export const freedrawPlugin: ShapePlugin<FreedrawShape> = {
	type: "freedraw",
	name: "Free Draw",
	component: Freedraw,

	createDefaultShape: ({ id, x, y }) => ({
		id,
		type: "freedraw",
		x,
		y,
		width: 0,
		height: 0,
		points: [],
		rotation: 0,
		opacity: DEFAULT_FREEDRAW_STYLES.opacity,
		strokeColor: DEFAULT_FREEDRAW_STYLES.strokeColor,
		fillColor: DEFAULT_FREEDRAW_STYLES.fillColor,
		strokeWidth: DEFAULT_FREEDRAW_STYLES.strokeWidth,
	}),

	getBounds: (shape) => {
		if (shape.points.length === 0) {
			return {
				x: shape.x,
				y: shape.y,
				width: 0,
				height: 0,
			};
		}

		// Calculate bounds from points
		let minX = shape.points[0].x;
		let maxX = shape.points[0].x;
		let minY = shape.points[0].y;
		let maxY = shape.points[0].y;

		for (const point of shape.points) {
			minX = Math.min(minX, point.x);
			maxX = Math.max(maxX, point.x);
			minY = Math.min(minY, point.y);
			maxY = Math.max(maxY, point.y);
		}

		return {
			x: shape.x + minX,
			y: shape.y + minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	},

	hitTest: (shape, point) => {
		if (shape.points.length < 2) {
			return false;
		}

		// Check if point is near any segment of the path
		const tolerance = shape.strokeWidth + 5; // Add some tolerance for easier selection
		const toleranceSq = tolerance * tolerance;

		for (let i = 0; i < shape.points.length - 1; i++) {
			const p1 = {
				x: shape.x + shape.points[i].x,
				y: shape.y + shape.points[i].y,
			};
			const p2 = {
				x: shape.x + shape.points[i + 1].x,
				y: shape.y + shape.points[i + 1].y,
			};

			// Calculate distance from point to line segment
			const distSq = distanceToSegmentSquared(point, p1, p2);
			if (distSq <= toleranceSq) {
				return true;
			}
		}

		return false;
	},

	validate: (shape) => {
		return (
			shape.type === "freedraw" &&
			Array.isArray(shape.points) &&
			shape.points.every((p) => typeof p.x === "number" && typeof p.y === "number")
		);
	},

	serialize: (shape) => ({
		...shape,
		// Optionally convert to SVG path for more efficient storage
		path: shape.path || pointsToPath(shape.points),
	}),

	deserialize: (data) =>
		({
			...data,
			type: "freedraw",
			points: data.points || pathToPoints(data.path),
		}) as FreedrawShape,

	getResizeHandles: (shape) => {
		const bounds = freedrawPlugin.getBounds(shape);
		return [
			// Top-left
			{ x: bounds.x, y: bounds.y },
			// Top-right
			{ x: bounds.x + bounds.width, y: bounds.y },
			// Bottom-right
			{ x: bounds.x + bounds.width, y: bounds.y + bounds.height },
			// Bottom-left
			{ x: bounds.x, y: bounds.y + bounds.height },
		];
	},

	getRotationHandle: (shape) => {
		const bounds = freedrawPlugin.getBounds(shape);
		return {
			x: bounds.x + bounds.width / 2,
			y: bounds.y - 30,
		};
	},
};

// Helper functions

function distanceToSegmentSquared(
	point: { x: number; y: number },
	p1: { x: number; y: number },
	p2: { x: number; y: number },
): number {
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;

	if (dx !== 0 || dy !== 0) {
		const t = Math.max(
			0,
			Math.min(1, ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / (dx * dx + dy * dy)),
		);

		const nearestX = p1.x + t * dx;
		const nearestY = p1.y + t * dy;

		const distX = point.x - nearestX;
		const distY = point.y - nearestY;

		return distX * distX + distY * distY;
	}

	const distX = point.x - p1.x;
	const distY = point.y - p1.y;
	return distX * distX + distY * distY;
}

function pointsToPath(points: Array<{ x: number; y: number }>): string {
	if (points.length === 0) return "";

	let path = `M ${points[0].x} ${points[0].y}`;
	for (let i = 1; i < points.length; i++) {
		path += ` L ${points[i].x} ${points[i].y}`;
	}
	return path;
}

function pathToPoints(path: string | undefined): Array<{ x: number; y: number }> {
	if (!path) return [];

	// Simple parser for M and L commands only
	const points: Array<{ x: number; y: number }> = [];
	const commands = path.match(/[ML]\s*[\d.-]+\s+[\d.-]+/g);

	if (commands) {
		commands.forEach((cmd) => {
			const parts = cmd.match(/[\d.-]+/g);
			if (parts && parts.length >= 2) {
				points.push({
					x: parseFloat(parts[0]),
					y: parseFloat(parts[1]),
				});
			}
		});
	}

	return points;
}
