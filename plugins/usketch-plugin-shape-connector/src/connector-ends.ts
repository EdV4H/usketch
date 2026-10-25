import {
	type AnchorType,
	clampToShapeEdge,
	getAnchorPoint,
	getAnchorRatio,
} from "@edv4h/usketch-connector-anchor";
import type { Point, ShapeData } from "@edv4h/usketch-shared";
import type { ConnectorShapeData } from "./types.js";

/** A drag shorter than this many screen px is a click and creates nothing. */
export const MIN_DRAG_SCREEN_PX = 4;

/** Whether a drag between two world points is too short to count (measured on screen). */
export function isTooShortDrag(from: Point, to: Point, zoom: number): boolean {
	return Math.hypot(to.x - from.x, to.y - from.y) * Math.abs(zoom) < MIN_DRAG_SCREEN_PX;
}

/**
 * One end of a connector. `shape: null` is a free end fixed at `point`.
 * On a shape, `point` is used only for the `"custom"` anchor.
 */
export interface ConnectorEndSpec {
	shape: ShapeData | null;
	anchor: AnchorType;
	point: Point;
}

export type ConnectorEnds = Required<
	Pick<
		ConnectorShapeData,
		"sourceAnchor" | "targetAnchor" | "sourcePoint" | "targetPoint" | "x" | "y" | "width" | "height"
	>
> &
	Pick<ConnectorShapeData, "sourceId" | "targetId" | "sourceAnchorRatio" | "targetAnchorRatio">;

function centerOf(shape: ShapeData): Point {
	return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

/** The end's point when it does not depend on the other end, else `null` ("auto" on a shape). */
function fixedPoint(end: ConnectorEndSpec): Point | null {
	if (!end.shape || end.anchor === "custom") return end.point;
	if (end.anchor === "auto") return null;
	return getAnchorPoint(end.shape, end.anchor);
}

/**
 * Resolve both ends of a connector into its shape fields. Free ends stay at
 * their point; an `"auto"` end on a shape faces the other end. `sourceId` /
 * `targetId` are always present (`undefined` for a free end) so the result can
 * clear a previous connection when applied as an update.
 */
export function resolveConnectorEnds(
	source: ConnectorEndSpec,
	target: ConnectorEndSpec,
): ConnectorEnds {
	const fixedTarget = fixedPoint(target);
	const sourcePoint =
		fixedPoint(source) ??
		getAnchorPoint(
			source.shape as ShapeData,
			"auto",
			fixedTarget ?? centerOf(target.shape as ShapeData),
		);
	const targetPoint = fixedTarget ?? getAnchorPoint(target.shape as ShapeData, "auto", sourcePoint);
	return {
		sourceId: source.shape?.id,
		targetId: target.shape?.id,
		sourceAnchor: source.anchor,
		targetAnchor: target.anchor,
		sourcePoint,
		targetPoint,
		x: Math.min(sourcePoint.x, targetPoint.x),
		y: Math.min(sourcePoint.y, targetPoint.y),
		width: Math.abs(targetPoint.x - sourcePoint.x),
		height: Math.abs(targetPoint.y - sourcePoint.y),
	};
}

/**
 * Where a dragged connector end lands. Dropped on the shape it is already on →
 * slides along its edge (custom anchor). On another shape → connects ("auto").
 * On empty space → free end at that point (detaching it if it was connected).
 * The other end keeps its connection, anchor and point. A slid custom end also
 * stores its ratio on the shape, which the tracker recomputes the point from.
 */
export function moveConnectorEnd(
	connector: ConnectorShapeData,
	endpoint: "source" | "target",
	drop: { shape: ShapeData | null; point: Point },
	getShape: (id: string) => ShapeData | undefined,
): ConnectorEnds {
	const isSource = endpoint === "source";
	const currentId = isSource ? connector.sourceId : connector.targetId;
	const otherId = isSource ? connector.targetId : connector.sourceId;

	let moved: ConnectorEndSpec;
	if (drop.shape && drop.shape.id === currentId) {
		moved = {
			shape: drop.shape,
			anchor: "custom",
			point: clampToShapeEdge(drop.shape, drop.point),
		};
	} else {
		moved = { shape: drop.shape, anchor: "auto", point: drop.point };
	}

	const otherShape = otherId ? getShape(otherId) : undefined;
	const other: ConnectorEndSpec = {
		shape: otherShape ?? null,
		anchor: otherShape
			? ((isSource ? connector.targetAnchor : connector.sourceAnchor) ?? "auto")
			: "auto",
		point: ((isSource ? connector.targetPoint : connector.sourcePoint) ?? {
			x: connector.x,
			y: connector.y,
		}) as Point,
	};

	const ends = isSource ? resolveConnectorEnds(moved, other) : resolveConnectorEnds(other, moved);
	if (moved.anchor === "custom" && moved.shape) {
		ends[isSource ? "sourceAnchorRatio" : "targetAnchorRatio"] = getAnchorRatio(
			moved.shape,
			moved.point,
		);
	}
	return ends;
}

export interface EndpointDropChange {
	from: Partial<ConnectorShapeData>;
	to: Partial<ConnectorShapeData>;
}

/**
 * The undoable change for dropping a dragged connector end (see
 * {@link moveConnectorEnd}). `drop.shape` is the shape under the drop point
 * (`null` for empty space). Returns `null` when nothing changes: a click
 * without real movement, or a drop onto the shape the other end is on.
 *
 * With `freeEnds` off, a drop on empty space keeps the end on its current
 * shape and slides it along the edge (the behavior before free ends); an end
 * that has no shape then stays where it is.
 */
export function computeEndpointDrop(
	connector: ConnectorShapeData,
	endpoint: "source" | "target",
	drop: { shape: ShapeData | null; point: Point },
	options: {
		startPoint: Point;
		zoom: number;
		freeEnds: boolean;
		getShape: (id: string) => ShapeData | undefined;
	},
): EndpointDropChange | null {
	if (isTooShortDrag(options.startPoint, drop.point, options.zoom)) return null;
	const isSource = endpoint === "source";
	const otherId = isSource ? connector.targetId : connector.sourceId;
	if (drop.shape && drop.shape.id === otherId) return null;

	let shape = drop.shape;
	if (!shape && !options.freeEnds) {
		const currentId = isSource ? connector.sourceId : connector.targetId;
		shape = (currentId && options.getShape(currentId)) || null;
		if (!shape) return null;
	}

	const to: Partial<ConnectorShapeData> = moveConnectorEnd(
		connector,
		endpoint,
		{ shape, point: drop.point },
		options.getShape,
	);
	const from = Object.fromEntries(
		Object.keys(to).map((key) => [key, connector[key as keyof ConnectorShapeData]]),
	) as Partial<ConnectorShapeData>;
	return { from, to };
}
