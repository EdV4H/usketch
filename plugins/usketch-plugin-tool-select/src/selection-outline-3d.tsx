// The selection in a 3D view of the board. The flat selection frame lies on the ground
// at height 0, so on a hill, a box's top or a standing sign it is drawn away from the
// shape. While the board is shown in 3D this screen layer outlines each selected (and
// hovered) shape where it is drawn instead — the corners the canvas projects for it
// (`view3dPickService.outlineOf`) — and the flat frame and handles step aside.
import {
	type BoardStore,
	isView3dShown,
	type Point,
	type ServiceRegistry,
	view3dCellOf,
	view3dPickService,
} from "@edv4h/usketch-shared";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { getMovingSelection, subscribeMovingSelection } from "./drag-state.js";
import type { OverlayColorStore } from "./overlay-colors.js";

/** The select tool's 3D outline layer. */
export const SELECTION_OUTLINE_3D_LAYER_ID = "usketch-plugin-tool-select:outline-3d";

/** Whether the board is shown in 3D now, re-rendering when that changes. */
export function useView3dShown(store: BoardStore): boolean {
	const subscribe = useCallback(
		(cb: () => void) => view3dCellOf(store)?.subscribe(cb) ?? (() => {}),
		[store],
	);
	const get = () => isView3dShown(store);
	return useSyncExternalStore(subscribe, get, get);
}

/** Changes of the store or the 3D view (the camera moves the outlines on screen). */
function useBoardVersion(store: BoardStore): number {
	const version = useRef(0);
	const subscribe = useCallback(
		(cb: () => void) => {
			const bump = () => {
				version.current++;
				cb();
			};
			const offStore = store.subscribe(bump);
			const offView = view3dCellOf(store)?.subscribe(bump);
			return () => {
				offStore();
				offView?.();
			};
		},
		[store],
	);
	const get = () => version.current;
	return useSyncExternalStore(subscribe, get, get);
}

/** An SVG `points` list. Pure. */
export function polygonPoints(corners: readonly Point[]): string {
	return corners.map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(" ");
}

export interface SelectionOutline3dProps {
	store: BoardStore;
	services: ServiceRegistry;
	colors: OverlayColorStore;
	/** The select tool's id (outlines show only while it is active). */
	toolId: string;
}

export function SelectionOutline3d({ store, services, colors, toolId }: SelectionOutline3dProps) {
	const { strokeColor } = useSyncExternalStore(
		colors.subscribe,
		colors.getSnapshot,
		colors.getSnapshot,
	);
	const isMoving = useSyncExternalStore(
		subscribeMovingSelection,
		getMovingSelection,
		getMovingSelection,
	);
	useBoardVersion(store);
	if (!isView3dShown(store) || store.getActiveToolId() !== toolId) return null;
	const api = view3dPickService.get(services);
	if (!api?.outlineOf) return null;
	const selection = store.getSelection();
	const hovered = store.getHoveredShapeId();
	const outlines: { id: string; points: string; hover: boolean }[] = [];
	for (const id of selection) {
		const corners = api.outlineOf(id);
		if (corners) outlines.push({ id, points: polygonPoints(corners), hover: false });
	}
	if (hovered && !selection.has(hovered) && !isMoving) {
		const corners = api.outlineOf(hovered);
		if (corners) outlines.push({ id: hovered, points: polygonPoints(corners), hover: true });
	}
	if (outlines.length === 0) return null;
	return (
		<svg
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width: "100%",
				height: "100%",
				overflow: "visible",
				pointerEvents: "none",
			}}
		>
			{outlines.map((o) => (
				<polygon
					key={o.id}
					points={o.points}
					fill="none"
					strokeWidth={o.hover ? 2 : 1.5}
					strokeLinejoin="round"
					opacity={o.hover ? 0.8 : 1}
					style={{ stroke: strokeColor }}
				/>
			))}
		</svg>
	);
}
