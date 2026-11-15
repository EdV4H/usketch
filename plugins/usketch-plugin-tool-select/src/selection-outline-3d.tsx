// The selection in a 3D view of the board. The flat selection frame lies on the ground
// at height 0, so on a hill, a box's top or a standing sign it is drawn away from the
// shape. While the board is shown in 3D this screen layer outlines each selected (and
// hovered) shape where it is drawn instead — the corners the canvas projects for it
// (`view3dPickService.outlineOf`) — and the flat frame and handles step aside. What the
// ground hides from the eye is drawn faint and dashed (so a selected shape behind a hill
// can still be found without looking as if it shows through), or left out: the select
// tool's `occludedOutline` option.
import {
	type BoardStore,
	isView3dShown,
	type OutlineRun,
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

/** How the part of a 3D selection outline the ground hides is drawn. */
export type OccludedOutline = "dashed" | "hidden";

/** The select tool's 3D outline settings (per setup, like the overlay colors). */
export interface Outline3dSettings {
	getSnapshot(): OccludedOutline;
	subscribe(listener: () => void): () => void;
	/** Ignores anything but `"dashed"` / `"hidden"`. */
	set(value: OccludedOutline | undefined): void;
}

export function createOutline3dSettings(initial?: OccludedOutline): Outline3dSettings {
	let value: OccludedOutline = "dashed";
	const listeners = new Set<() => void>();
	const settings: Outline3dSettings = {
		getSnapshot: () => value,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		set(next) {
			if ((next !== "dashed" && next !== "hidden") || next === value) return;
			value = next;
			for (const l of listeners) l();
		},
	};
	settings.set(initial);
	return settings;
}

/** The runs to draw: the hidden ones dropped when they are not shown. Pure. */
export function visibleRuns(runs: readonly OutlineRun[], occluded: OccludedOutline): OutlineRun[] {
	return occluded === "hidden" ? runs.filter((r) => !r.hidden) : [...runs];
}

/** Outlines cut where the ground hides them, up to this many (each costs ground samples). */
export const MAX_OCCLUSION_OUTLINES = 16;

/** An SVG `points` list. Pure. */
export function polygonPoints(corners: readonly Point[]): string {
	return corners.map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(" ");
}

/** How faint the part of an outline hidden behind the ground is drawn. */
const HIDDEN_OPACITY = 0.4;

/** Corners as one closed run in view (a canvas without `outlineRunsOf`, or too many). */
function closedRun(corners: Point[] | null | undefined): OutlineRun[] | null {
	return corners ? [{ points: corners, hidden: false, closed: true }] : null;
}

export interface SelectionOutline3dProps {
	store: BoardStore;
	services: ServiceRegistry;
	colors: OverlayColorStore;
	/** How the part the ground hides is drawn. */
	settings: Outline3dSettings;
	/** The select tool's id (outlines show only while it is active). */
	toolId: string;
}

export function SelectionOutline3d({
	store,
	services,
	colors,
	settings,
	toolId,
}: SelectionOutline3dProps) {
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
	const occluded = useSyncExternalStore(
		settings.subscribe,
		settings.getSnapshot,
		settings.getSnapshot,
	);
	useBoardVersion(store);
	if (!isView3dShown(store) || store.getActiveToolId() !== toolId) return null;
	const api = view3dPickService.get(services);
	if (!api?.outlineOf) return null;
	const selection = store.getSelection();
	const hovered = store.getHoveredShapeId();
	const ids: { id: string; hover: boolean }[] = [...selection].map((id) => ({ id, hover: false }));
	if (hovered && !selection.has(hovered) && !isMoving) ids.push({ id: hovered, hover: true });
	const occlusion = !!api.outlineRunsOf && ids.length <= MAX_OCCLUSION_OUTLINES;
	const outlines: { id: string; runs: OutlineRun[]; hover: boolean }[] = [];
	for (const { id, hover } of ids) {
		const runs = occlusion ? api.outlineRunsOf?.(id) : closedRun(api.outlineOf(id));
		if (runs) outlines.push({ id, runs: visibleRuns(runs, occluded), hover });
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
			{outlines.flatMap((o) =>
				o.runs.map((run, i) => {
					const Tag = run.closed ? "polygon" : "polyline";
					return (
						<Tag
							// biome-ignore lint/suspicious/noArrayIndexKey: runs are positional along the outline
							key={`${o.id}:${i}`}
							points={polygonPoints(run.points)}
							fill="none"
							strokeWidth={o.hover ? 2 : 1.5}
							strokeLinejoin="round"
							strokeLinecap="round"
							strokeDasharray={run.hidden ? "4 4" : undefined}
							opacity={(o.hover ? 0.8 : 1) * (run.hidden ? HIDDEN_OPACITY : 1)}
							style={{ stroke: strokeColor }}
						/>
					);
				}),
			)}
		</svg>
	);
}
