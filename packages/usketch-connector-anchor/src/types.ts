import type { Point, ShapeData } from "@edv4h/usketch-shared";
import type { AnchorType } from "./anchor-utils.js";
import type { PathType } from "./path-utils.js";

/** Arrow head style for a connector. */
export type ArrowHead = "none" | "forward" | "backward" | "both";

/**
 * Common shape fields used by any connector implementation.
 * Concrete connectors (e.g. base `connector`, `domain-connector`) extend this
 * with their own `type` literal and `meta` payload.
 */
export interface ConnectableShapeData extends ShapeData {
	sourceId?: string;
	targetId?: string;
	sourceAnchor?: AnchorType;
	targetAnchor?: AnchorType;
	sourcePoint?: Point;
	targetPoint?: Point;
	controlPoint?: Point;
	controlPointAuto?: boolean;
	arrowHead?: ArrowHead;
	pathType?: PathType;
	label?: string;
}

export type { AnchorType, PathType };
