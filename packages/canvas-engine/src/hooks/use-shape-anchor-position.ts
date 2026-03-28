import { boundsToScreenRect, getSelectionBounds } from "@edv4h/usketch-shared";
import { useMemo } from "react";
import { useApp } from "../context.js";
import type { AnchorPosition, AnchorResult, ShapeAnchorOptions } from "../types/shape-anchor.js";
import { useStoreSubscribe } from "./use-store-subscribe.js";

const DEFAULT_GAP = 12;

function computeAnchor(
	position: AnchorPosition,
	screen: {
		x: number;
		y: number;
		width: number;
		height: number;
		centerX: number;
		centerY: number;
		bottom: number;
	},
	gap: number,
): { x: number; y: number } {
	switch (position) {
		case "bottom":
			return { x: screen.centerX, y: screen.bottom + gap };
		case "top":
			return { x: screen.centerX, y: screen.y - gap };
		case "right":
			return { x: screen.x + screen.width + gap, y: screen.centerY };
		case "left":
			return { x: screen.x - gap, y: screen.centerY };
	}
}

export function useShapeAnchorPosition(options: ShapeAnchorOptions): AnchorResult {
	const { position, fallback, gap = DEFAULT_GAP } = options;
	const app = useApp();

	const shapeIdSet = useMemo(() => {
		if (options.shapeIds instanceof Set) return options.shapeIds as ReadonlySet<string>;
		return new Set(options.shapeIds);
	}, [options.shapeIds]);

	const viewport = useStoreSubscribe(app.store, (s) => s.getViewport());
	useStoreSubscribe(app.store, (s) => s.getShapes());

	const getBounds = useMemo(() => {
		return (id: string) => {
			const shape = app.store.getShape(id);
			if (!shape) return null;
			const def = app.shapes.get(shape.type);
			return def
				? def.getBounds(shape)
				: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
		};
	}, [app.store, app.shapes]);

	const invisible: AnchorResult = {
		x: 0,
		y: 0,
		visible: false,
		actualPosition: position,
		screenBounds: null,
		fallbackPosition: null,
		fallbackX: 0,
		fallbackY: 0,
	};

	if (shapeIdSet.size === 0) return invisible;

	const worldBounds = getSelectionBounds(shapeIdSet, getBounds);
	if (!worldBounds) return invisible;

	const screen = boundsToScreenRect(worldBounds, viewport);

	if (
		screen.x + screen.width < 0 ||
		screen.x > window.innerWidth ||
		screen.y + screen.height < 0 ||
		screen.y > window.innerHeight
	) {
		return invisible;
	}

	const screenBounds = {
		x: screen.x,
		y: screen.y,
		width: screen.width,
		height: screen.height,
	};

	const primary = computeAnchor(position, screen, gap);
	const fb = fallback ? computeAnchor(fallback, screen, gap) : null;

	return {
		...primary,
		visible: true,
		actualPosition: position,
		screenBounds,
		fallbackPosition: fallback ?? null,
		fallbackX: fb?.x ?? 0,
		fallbackY: fb?.y ?? 0,
	};
}
