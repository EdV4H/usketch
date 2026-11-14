import type { AnchorType } from "@edv4h/usketch-connector-anchor";
import type { Point, ShapeData } from "@edv4h/usketch-shared";

/** A connector being drawn from a shape's anchor handle. */
export interface AnchorDrawState {
	connectorId: string;
	sourceShape: ShapeData;
	sourceAnchor: AnchorType;
	/** Target shape under the pointer. */
	targetShapeId: string | null;
	/** Resolved target anchor (snapped or custom). */
	targetAnchor: AnchorType;
	/** Resolved target point. */
	targetPoint: Point | null;
}

/** A connector end (or the curve's control point) being dragged. */
export interface EndpointDragState {
	connectorId: string;
	endpoint: "source" | "target" | "controlPoint";
	currentPoint: Point;
	targetShapeId: string | null;
}

export interface ConnectorHandleState {
	anchorDraw: AnchorDrawState | null;
	endpointDrag: EndpointDragState | null;
}

/**
 * The connector handles' drag state, one per plugin instance (so two boards on a
 * page never share it). The handle overlays read it for their drag feedback.
 */
export interface ConnectorHandleStore {
	get(): ConnectorHandleState;
	set(patch: Partial<ConnectorHandleState>): void;
	subscribe(listener: () => void): () => void;
}

export function createConnectorHandleStore(): ConnectorHandleStore {
	let state: ConnectorHandleState = { anchorDraw: null, endpointDrag: null };
	const listeners = new Set<() => void>();
	return {
		get: () => state,
		set(patch) {
			state = { ...state, ...patch };
			for (const l of listeners) l();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
