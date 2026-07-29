import type { BoardStore } from "@edv4h/usketch-shared";
import { fitContent, zoomBy, zoomToLevel } from "@edv4h/usketch-shared";

const ZOOM_STEP = 1.2;

// Keyboard zoom is logic-driven → smooth by default (the shared helpers animate).
export function zoomIn(store: BoardStore): void {
	zoomBy(store, ZOOM_STEP);
}

export function zoomOut(store: BoardStore): void {
	zoomBy(store, 1 / ZOOM_STEP);
}

export function zoomReset(store: BoardStore): void {
	zoomToLevel(store, 1);
}

export function zoomFit(store: BoardStore): void {
	fitContent(store);
}
