import type { BoardStore } from "@edv4h/usketch-shared";

const ZOOM_STEP = 1.2;
const FIT_PADDING = 0.9;

function screenCenter(): { x: number; y: number } {
	return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

export function zoomIn(store: BoardStore): void {
	const vp = store.getViewport();
	store.zoomTo(vp.zoom * ZOOM_STEP, screenCenter());
}

export function zoomOut(store: BoardStore): void {
	const vp = store.getViewport();
	store.zoomTo(vp.zoom / ZOOM_STEP, screenCenter());
}

export function zoomReset(store: BoardStore): void {
	store.zoomTo(1, screenCenter());
}

export function zoomFit(store: BoardStore): void {
	const shapes = store.getShapes();
	if (shapes.size === 0) return;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const shape of shapes.values()) {
		minX = Math.min(minX, shape.x);
		minY = Math.min(minY, shape.y);
		maxX = Math.max(maxX, shape.x + shape.width);
		maxY = Math.max(maxY, shape.y + shape.height);
	}

	const contentW = maxX - minX;
	const contentH = maxY - minY;
	if (contentW <= 0 || contentH <= 0) return;

	const rawZoom =
		Math.min(window.innerWidth / contentW, window.innerHeight / contentH) * FIT_PADDING;
	const zoom = Math.min(10, Math.max(0.1, rawZoom));

	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;

	store.setViewport({
		x: window.innerWidth / 2 - cx * zoom,
		y: window.innerHeight / 2 - cy * zoom,
		zoom,
	});
}
