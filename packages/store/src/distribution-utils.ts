import type { Shape } from "@usketch/shared-types";

export type DistributionDirection = "horizontal" | "vertical";

/**
 * Calculate distribution positions for multiple shapes
 * Distributes shapes evenly between the first and last shape
 */
export function calculateDistribution(
	shapes: Shape[],
	direction: DistributionDirection,
): Map<string, { x: number; y: number }> {
	const updates = new Map<string, { x: number; y: number }>();

	if (shapes.length < 3) return updates; // Need at least 3 shapes to distribute

	// Sort shapes by position
	const sortedShapes = [...shapes].sort((a, b) => {
		if (direction === "horizontal") {
			return a.x - b.x;
		} else {
			return a.y - b.y;
		}
	});

	if (direction === "horizontal") {
		// Get the leftmost and rightmost positions
		const firstShape = sortedShapes[0];
		const lastShape = sortedShapes[sortedShapes.length - 1];

		if (!firstShape || !lastShape) return updates;

		const firstWidth = "width" in firstShape ? firstShape.width : 0;
		const lastWidth = "width" in lastShape ? lastShape.width : 0;

		const startX = firstShape.x + firstWidth / 2;
		const endX = lastShape.x + lastWidth / 2;
		const totalDistance = endX - startX;
		const spacing = totalDistance / (sortedShapes.length - 1);

		// Distribute shapes evenly between first and last
		sortedShapes.forEach((shape, index) => {
			if (index === 0 || index === sortedShapes.length - 1) {
				// Keep first and last shapes in place
				updates.set(shape.id, { x: shape.x, y: shape.y });
			} else {
				const width = "width" in shape ? shape.width : 0;
				const centerX = startX + spacing * index;
				updates.set(shape.id, { x: centerX - width / 2, y: shape.y });
			}
		});
	} else {
		// Vertical distribution
		const firstShape = sortedShapes[0];
		const lastShape = sortedShapes[sortedShapes.length - 1];

		if (!firstShape || !lastShape) return updates;

		const firstHeight = "height" in firstShape ? firstShape.height : 0;
		const lastHeight = "height" in lastShape ? lastShape.height : 0;

		const startY = firstShape.y + firstHeight / 2;
		const endY = lastShape.y + lastHeight / 2;
		const totalDistance = endY - startY;
		const spacing = totalDistance / (sortedShapes.length - 1);

		// Distribute shapes evenly between first and last
		sortedShapes.forEach((shape, index) => {
			if (index === 0 || index === sortedShapes.length - 1) {
				// Keep first and last shapes in place
				updates.set(shape.id, { x: shape.x, y: shape.y });
			} else {
				const height = "height" in shape ? shape.height : 0;
				const centerY = startY + spacing * index;
				updates.set(shape.id, { x: shape.x, y: centerY - height / 2 });
			}
		});
	}

	return updates;
}
