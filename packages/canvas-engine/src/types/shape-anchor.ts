export type AnchorPosition = "top" | "bottom" | "left" | "right";

export interface ShapeAnchorOptions {
	/** Shape IDs to anchor to. If multiple, uses combined bounding box. */
	shapeIds: ReadonlySet<string> | string[];
	/** Which side of the shape's bounding box to anchor to. */
	position: AnchorPosition;
	/** Fallback position when the primary position doesn't fit in the viewport. */
	fallback?: AnchorPosition;
	/** Gap in screen pixels between the shape edge and the overlay. Default: 12 */
	gap?: number;
	/** Minimum padding from viewport edges in screen pixels. Default: 8 */
	edgePadding?: number;
}

export interface AnchorResult {
	/** Screen-space X for the overlay's anchor point. */
	x: number;
	/** Screen-space Y for the overlay's anchor point. */
	y: number;
	/** Whether the overlay should be visible (false when shape is off-screen). */
	visible: boolean;
	/** The requested anchor position. */
	actualPosition: AnchorPosition;
	/** Screen-space bounding rect of the anchored shape(s). */
	screenBounds: { x: number; y: number; width: number; height: number } | null;
	/** Fallback position (null if not specified). */
	fallbackPosition: AnchorPosition | null;
	/** Fallback anchor X. */
	fallbackX: number;
	/** Fallback anchor Y. */
	fallbackY: number;
}
