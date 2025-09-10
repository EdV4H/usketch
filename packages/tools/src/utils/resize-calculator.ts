import type { Bounds, Point } from "../types";

// Calculate new bounds based on resize handle and delta
export function calculateNewBounds(
	originalBounds: Bounds,
	handle: string,
	delta: Point,
	maintainAspectRatio: boolean = false,
): Bounds {
	const { x, y, width, height } = originalBounds;
	let newX = x;
	let newY = y;
	let newWidth = width;
	let newHeight = height;

	// Calculate new bounds based on handle
	switch (handle) {
		case "nw": // North-West (top-left)
			newX = x + delta.x;
			newY = y + delta.y;
			newWidth = width - delta.x;
			newHeight = height - delta.y;
			break;

		case "n": // North (top)
			newY = y + delta.y;
			newHeight = height - delta.y;
			break;

		case "ne": // North-East (top-right)
			newY = y + delta.y;
			newWidth = width + delta.x;
			newHeight = height - delta.y;
			break;

		case "e": // East (right)
			newWidth = width + delta.x;
			break;

		case "se": // South-East (bottom-right)
			newWidth = width + delta.x;
			newHeight = height + delta.y;
			break;

		case "s": // South (bottom)
			newHeight = height + delta.y;
			break;

		case "sw": // South-West (bottom-left)
			newX = x + delta.x;
			newWidth = width - delta.x;
			newHeight = height + delta.y;
			break;

		case "w": // West (left)
			newX = x + delta.x;
			newWidth = width - delta.x;
			break;
	}

	// Apply minimum size constraints
	const MIN_SIZE = 20;
	if (newWidth < MIN_SIZE) {
		if (handle.includes("w")) {
			newX = x + width - MIN_SIZE;
		}
		newWidth = MIN_SIZE;
	}
	if (newHeight < MIN_SIZE) {
		if (handle.includes("n")) {
			newY = y + height - MIN_SIZE;
		}
		newHeight = MIN_SIZE;
	}

	// Maintain aspect ratio if requested
	if (maintainAspectRatio && width > 0 && height > 0) {
		const aspectRatio = width / height;

		// For corner handles, maintain aspect ratio
		if (["nw", "ne", "se", "sw"].includes(handle)) {
			// Determine which dimension changed more
			const widthChange = Math.abs(newWidth - width);
			const heightChange = Math.abs(newHeight - height);

			if (widthChange > heightChange) {
				// Adjust height based on width
				const targetHeight = newWidth / aspectRatio;
				if (handle.includes("n")) {
					newY = y + height - targetHeight;
				}
				newHeight = targetHeight;
			} else {
				// Adjust width based on height
				const targetWidth = newHeight * aspectRatio;
				if (handle.includes("w")) {
					newX = x + width - targetWidth;
				}
				newWidth = targetWidth;
			}
		}
	}

	return {
		x: newX,
		y: newY,
		width: Math.max(MIN_SIZE, newWidth),
		height: Math.max(MIN_SIZE, newHeight),
	};
}

// Get cursor style for resize handle
export function getResizeCursor(handle: string): string {
	const cursors: Record<string, string> = {
		nw: "nw-resize",
		n: "n-resize",
		ne: "ne-resize",
		e: "e-resize",
		se: "se-resize",
		s: "s-resize",
		sw: "sw-resize",
		w: "w-resize",
	};
	return cursors[handle] || "default";
}

// Check if a point is near a resize handle
export function isPointNearHandle(
	point: Point,
	handlePosition: Point,
	tolerance: number = 10,
): boolean {
	const distance = Math.sqrt((point.x - handlePosition.x) ** 2 + (point.y - handlePosition.y) ** 2);
	return distance <= tolerance;
}
