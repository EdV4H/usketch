import type { Point } from "@edv4h/usketch-shared";

export interface EndpointDragState {
	connectorId: string;
	endpoint: "source" | "target" | "controlPoint";
	currentPoint: Point;
	targetShapeId: string | null;
}

let state: EndpointDragState | null = null;
const listeners: Set<() => void> = new Set();

function notify() {
	for (const fn of listeners) fn();
}

export function setEndpointDrag(s: EndpointDragState | null): void {
	state = s;
	notify();
}

export function getEndpointDrag(): EndpointDragState | null {
	return state;
}

export function subscribeEndpointDrag(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}
