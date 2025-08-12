/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(screenPoint, camera) {
	return {
		x: screenPoint.x / camera.zoom + camera.x,
		y: screenPoint.y / camera.zoom + camera.y,
	};
}
/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(worldPoint, camera) {
	return {
		x: (worldPoint.x - camera.x) * camera.zoom,
		y: (worldPoint.y - camera.y) * camera.zoom,
	};
}
/**
 * Get the mouse position relative to the canvas element
 */
export function getCanvasMousePosition(event, canvasElement) {
	const rect = canvasElement.getBoundingClientRect();
	return {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};
}
/**
 * Apply camera transform to a DOM element
 */
export function applyCameraTransform(element, camera) {
	element.style.transform = `translate(${-camera.x * camera.zoom}px, ${-camera.y * camera.zoom}px) scale(${camera.zoom})`;
}
/**
 * Apply shape transform to a DOM element
 */
export function applyShapeTransform(element, shape) {
	element.style.transform = `translate(${shape.x}px, ${shape.y}px) rotate(${shape.rotation}rad)`;
}
//# sourceMappingURL=coordinates.js.map
