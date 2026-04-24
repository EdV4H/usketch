import type { Point, ShapeData } from "@edv4h/usketch-shared";
import type { AnchorType } from "./anchor-utils.js";
import type { PathType } from "./path-utils.js";

/** Arrow head style for a connector. */
export type ArrowHead = "none" | "forward" | "backward" | "both";

/** Connector shape extension: intrinsic data for the `connector` shape. */
export interface ConnectorShapeData extends ShapeData {
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
