// The flat board's view of the elevation: the visible tiles (chunks at a level of
// detail, see elevation-tiles.ts), each one <canvas> drawn once and kept until its
// heights, its resolution or the look change. Panning only moves one wrapper. Tiles are
// drawn a few per frame (see the draw queue), so zooming out over an infinite terrain
// never blocks a frame for long. Input goes to tools; the layer is pointer-events:none.
import {
	type BoardStore,
	type GroundDecalApi,
	type GroundDecalView,
	type View3dApi,
	viewportRotation,
} from "@edv4h/usketch-shared";
import { memo, useEffect, useRef, useState } from "react";
import {
	DECAL_MARGIN,
	decalLookupArea,
	decalTileArea,
	paintDecalTile,
	tileWorldRect,
} from "./elevation-decals.js";
import { chunkKey } from "./elevation-field.js";
import {
	boardElevation,
	type DeltaValues,
	type ElevationModel,
	type ElevationSampler,
	elevationSampler,
} from "./elevation-model.js";
import { type ElevationDisplay, renderTilePixels } from "./elevation-shade.js";
import { planTiles, visibleWorldRect } from "./elevation-tiles.js";
import type { ReactiveStore } from "./reactive-store.js";

export const GROUND_LAYER_ID = "usketch-elevation:ground";

/**
 * Pixels each tile's bitmap reaches past its edges: a scaled canvas fades its outermost
 * pixels into transparency, so neighbours overlap by this much and no seam shows.
 */
const TILE_MARGIN = 2;

// ── Draw queue: tiles are drawn in the order they ask, within a time budget per frame ──

const FRAME_BUDGET_MS = 8;
const queue = new Map<object, () => void>();
let scheduled = false;

function runQueue(): void {
	scheduled = false;
	const start = performance.now();
	for (const [key, job] of queue) {
		queue.delete(key);
		job();
		if (performance.now() - start > FRAME_BUDGET_MS) break;
	}
	if (queue.size > 0) schedule();
}

function schedule(): void {
	if (scheduled) return;
	scheduled = true;
	if (typeof requestAnimationFrame === "function") requestAnimationFrame(runQueue);
	else setTimeout(runQueue, 0);
}

/** Queue `job` under `key` (a later job for the same key replaces it). Returns a cancel. */
export function queueDraw(key: object, job: () => void): () => void {
	queue.set(key, job);
	schedule();
	return () => {
		if (queue.get(key) === job) queue.delete(key);
	};
}

// ── Tile revisions: which deltas a tile reads ──

let nextArrayId = 1;
const arrayIds = new WeakMap<DeltaValues, number>();
const arrayId = (a: DeltaValues) => {
	let id = arrayIds.get(a);
	if (id === undefined) {
		id = nextArrayId++;
		arrayIds.set(a, id);
	}
	return id;
};

const edgeKeys = new WeakMap<DeltaValues, Map<string, string | null>>();

/**
 * A key for the strip of a neighbouring chunk that a level-0 tile reads (its samples
 * within 2 of the tile, for the margin and the edge slopes), `null` when the strip is all
 * zeros (the same as no chunk). So a brush stroke next to a tile redraws it only when
 * the stroke reaches that strip. Cached per array (arrays are never mutated).
 */
function edgeKey(a: DeltaValues, n: number, dx: number, dy: number): string | null {
	let byEdge = edgeKeys.get(a);
	if (!byEdge) {
		byEdge = new Map();
		edgeKeys.set(a, byEdge);
	}
	const side = `${dx},${dy}`;
	const hit = byEdge.get(side);
	if (hit !== undefined) return hit;
	const range = (d: number): [number, number] =>
		d < 0 ? [n - 2, n - 1] : d > 0 ? [0, Math.min(2, n - 1)] : [0, n - 1];
	const [i0, i1] = range(dx);
	const [j0, j1] = range(dy);
	let h = 0x811c9dc5;
	let any = false;
	for (let j = j0; j <= j1; j++) {
		for (let i = i0; i <= i1; i++) {
			const v = Math.round(a[j * n + i] * 64);
			if (v !== 0) any = true;
			h = Math.imul(h ^ v, 0x01000193);
		}
	}
	const key = any ? (h >>> 0).toString(36) : null;
	byEdge.set(side, key);
	return key;
}

/**
 * A key that changes exactly when the deltas a tile reads change: the chunks under the
 * tile and the ring of samples around it (its edge slopes). At level 0 a ring chunk counts
 * by the strip the tile reads; at coarser levels by its array.
 */
export function tileRevision(model: ElevationModel, level: number, tx: number, ty: number): string {
	const per = 2 ** level;
	const n = model.field.chunk;
	const cx0 = tx * per - 1;
	const cx1 = (tx + 1) * per;
	const cy0 = ty * per - 1;
	const cy1 = (ty + 1) * per;
	const parts: string[] = [];
	const add = (cx: number, cy: number, a: DeltaValues) => {
		if (level === 0 && (cx !== tx || cy !== ty)) {
			const k = edgeKey(a, n, cx - tx, cy - ty);
			if (k !== null) parts.push(`${cx},${cy}~${k}`);
			return;
		}
		parts.push(`${cx},${cy}:${arrayId(a)}`);
	};
	if ((per + 2) * (per + 2) <= model.chunks.size) {
		for (let cy = cy0; cy <= cy1; cy++) {
			for (let cx = cx0; cx <= cx1; cx++) {
				const a = model.chunks.get(chunkKey(cx, cy));
				if (a) add(cx, cy, a);
			}
		}
	} else {
		for (const [key, a] of model.chunks) {
			const [cx, cy] = key.split(",").map(Number);
			if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) add(cx, cy, a);
		}
		parts.sort();
	}
	return parts.join(";");
}

/** What a tile's look depends on besides its deltas: the field's terrain settings. */
function fieldKey(model: ElevationModel): string {
	const f = model.field;
	const g = f.gen;
	return `${f.id}|${f.spacing}|${f.chunk}|${f.seed}|${f.waterLevel}|${g.relief}|${g.scale}|${g.roughness}|${g.ridges}|${g.octaves}`;
}

/**
 * Bitmap size of a tile a brush stroke is changing: drawn every frame while the stroke
 * lasts, so coarser (it is drawn at full size again once the stroke is written).
 */
export const STROKE_TILE_PX = 128;

/** A brush stroke's elevation while it is drawn (`null`: none, the board's is shown). */
export interface StrokePreview {
	model: ElevationModel | null;
}

export function ElevationGroundLayer({
	store,
	display,
	overscan,
	preview,
	mesh,
	decals,
	view3d,
}: {
	store: BoardStore;
	display: ReactiveStore<ElevationDisplay>;
	/** Extra screen px of ground to draw past the viewport (a 3D view's far ground). */
	overscan: ReactiveStore<{ px: number }>;
	preview?: ReactiveStore<StrokePreview>;
	/** While the 3D mesh draws the ground, this layer draws nothing. */
	mesh?: ReactiveStore<{ drawing: boolean }>;
	/** Ground decals laid over the tiles: their `"flat"` view, or `"3d"` while this layer stands in for the mesh. */
	decals?: GroundDecalApi;
	/** The 3D view, to tell which of the decals' views this layer shows. */
	view3d?: () => View3dApi | undefined;
}) {
	const [, force] = useState(0);
	const rafRef = useRef(0);
	// One re-render per frame at most: a request while one is pending joins it (cancelling
	// and re-requesting would keep pushing it back while something notifies every frame).
	const rerender = useRef(() => {
		if (rafRef.current) return;
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = 0;
			force((n) => n + 1);
		});
	}).current;
	useEffect(() => {
		const offs = [
			store.subscribe(rerender),
			display.subscribe(rerender),
			overscan.subscribe(rerender),
			...(preview ? [preview.subscribe(rerender)] : []),
			...(mesh ? [mesh.subscribe(rerender)] : []),
			...(decals ? [decals.subscribe(rerender)] : []),
		];
		return () => {
			for (const off of offs) off();
			cancelAnimationFrame(rafRef.current);
			rafRef.current = 0;
		};
	}, [store, display, overscan, preview, mesh, decals, rerender]);
	// The 3D view as provided now: looked up on every render, so one provided (or
	// replaced) after this layer mounted is picked up on the next re-render.
	const viewApi = view3d?.();
	const shown3d = (viewApi?.amount() ?? 0) > 0;
	const shownRef = useRef(shown3d);
	shownRef.current = shown3d;
	useEffect(() => {
		if (!viewApi) return;
		// It notifies every frame while it moves: re-render only when it turns on / off.
		return viewApi.subscribe(() => {
			if (viewApi.amount() > 0 !== shownRef.current) rerender();
		});
	}, [viewApi, rerender]);
	const decalView: GroundDecalView = shown3d ? "3d" : "flat";

	// The 3D mesh draws the ground: nothing to draw here (no tiles kept busy meanwhile).
	if (mesh?.get().drawing) return null;
	const stored = boardElevation(store);
	const drafting = preview?.get().model ?? null;
	const model = drafting ?? stored;
	if (!model) return null;
	const vp = store.getViewport();
	const overscanPx = overscan.get().px;
	const rect = visibleWorldRect(store, overscanPx);
	const plan = rect ? planTiles(model.field, rect, vp.zoom) : null;
	if (!plan) return null;
	const sampler = elevationSampler(model);
	const look = display.get();
	const fk = fieldKey(model);
	const tiles = [];
	const decalTiles = [];
	const decalVersion = decals?.version() ?? 0;
	for (let ty = plan.ty0; ty <= plan.ty1; ty++) {
		for (let tx = plan.tx0; tx <= plan.tx1; tx++) {
			const left = Math.round(tx * plan.worldSize * vp.zoom);
			const top = Math.round(ty * plan.worldSize * vp.zoom);
			const revision = tileRevision(model, plan.level, tx, ty);
			// A tile the stroke is changing is redrawn every frame: draw it coarser.
			const changing =
				drafting !== null && revision !== (stored ? tileRevision(stored, plan.level, tx, ty) : "");
			tiles.push(
				<ElevationTile
					key={`${plan.level}:${tx},${ty}`}
					sampler={sampler}
					level={plan.level}
					tx={tx}
					ty={ty}
					px={changing ? Math.min(plan.px, STROKE_TILE_PX) : plan.px}
					left={left}
					top={top}
					width={Math.round((tx + 1) * plan.worldSize * vp.zoom) - left}
					height={Math.round((ty + 1) * plan.worldSize * vp.zoom) - top}
					revision={`${fk}#${revision}`}
					display={look}
				/>,
			);
			if (
				decals &&
				decals.listFor(decalView, decalLookupArea(tileWorldRect(tx, ty, plan.worldSize))).length > 0
			) {
				decalTiles.push(
					<DecalTile
						key={`decal:${plan.level}:${tx},${ty}`}
						decals={decals}
						view={decalView}
						version={decalVersion}
						tx={tx}
						ty={ty}
						worldSize={plan.worldSize}
						px={plan.px}
						left={left}
						top={top}
						width={Math.round((tx + 1) * plan.worldSize * vp.zoom) - left}
						height={Math.round((ty + 1) * plan.worldSize * vp.zoom) - top}
					/>,
				);
			}
		}
	}
	return (
		<div
			data-usketch-elevation=""
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				// Ground drawn past the viewport (3D overscan) or turned with the camera must
				// not be cut at the box.
				overflow: overscanPx > 0 || viewportRotation(vp) !== 0 ? "visible" : "hidden",
			}}
		>
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					transform: `translate(${vp.x}px, ${vp.y}px)`,
					willChange: "transform",
				}}
			>
				{tiles}
				{/* Over every ground tile (their margins overlap the neighbours). */}
				{decalTiles}
			</div>
		</div>
	);
}

interface TileProps {
	sampler: ElevationSampler;
	level: number;
	tx: number;
	ty: number;
	px: number;
	left: number;
	top: number;
	width: number;
	height: number;
	/** Changes exactly when the tile's pixels would (heights / field settings). */
	revision: string;
	display: ElevationDisplay;
}

/** One tile's canvas: redrawn only when its revision, resolution or the look change. */
const ElevationTile = memo(
	function ElevationTile(props: TileProps) {
		const ref = useRef<HTMLCanvasElement>(null);
		const latest = useRef(props);
		latest.current = props;
		const { level, tx, ty, px, revision, display } = props;
		// biome-ignore lint/correctness/useExhaustiveDependencies: the sampler is read from `latest`; `revision` stands for it
		useEffect(() => {
			const canvas = ref.current;
			if (!canvas) return;
			return queueDraw(canvas, () => {
				const ctx = canvas.getContext("2d");
				if (!ctx) return;
				const pixels = renderTilePixels({
					sampler: latest.current.sampler,
					level,
					tx,
					ty,
					size: px,
					margin: TILE_MARGIN,
					display,
				});
				const full = px + 2 * TILE_MARGIN;
				ctx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, full, full), 0, 0);
			});
		}, [level, tx, ty, px, revision, display]);
		// The bitmap's margin pixels reach past the tile's box on every side.
		const mx = (props.width / px) * TILE_MARGIN;
		const my = (props.height / px) * TILE_MARGIN;
		return (
			<canvas
				ref={ref}
				width={px + 2 * TILE_MARGIN}
				height={px + 2 * TILE_MARGIN}
				style={{
					position: "absolute",
					left: props.left - mx,
					top: props.top - my,
					width: props.width + 2 * mx,
					height: props.height + 2 * my,
				}}
			/>
		);
	},
	// The sampler is a new object whenever ANY chunk changes; the revision says whether
	// this tile's part did.
	(a, b) =>
		a.level === b.level &&
		a.tx === b.tx &&
		a.ty === b.ty &&
		a.px === b.px &&
		a.left === b.left &&
		a.top === b.top &&
		a.width === b.width &&
		a.height === b.height &&
		a.revision === b.revision &&
		a.display === b.display,
);

interface DecalTileProps {
	decals: GroundDecalApi;
	view: GroundDecalView;
	/** The registry's version: a change re-checks whether this tile must repaint. */
	version: number;
	tx: number;
	ty: number;
	worldSize: number;
	px: number;
	left: number;
	top: number;
	width: number;
	height: number;
}

/** One tile's ground decals, over its ground tile: repainted only when they change there. */
const DecalTile = memo(function DecalTile(props: DecalTileProps) {
	const ref = useRef<HTMLCanvasElement>(null);
	// What the bitmap holds: the registry version, view and size it was painted at.
	const painted = useRef<{ version: number; view: GroundDecalView; px: number } | null>(null);
	const { decals, view, version, tx, ty, worldSize, px } = props;
	// biome-ignore lint/correctness/useExhaustiveDependencies: `version` triggers the check
	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		const rect = tileWorldRect(tx, ty, worldSize);
		const was = painted.current;
		if (
			was &&
			was.view === view &&
			was.px === px &&
			!decals.changedSince(was.version, view, decalTileArea(rect, px))
		) {
			return;
		}
		return queueDraw(canvas, () => {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			const at = decals.version();
			paintDecalTile(ctx, decals, view, rect, px);
			painted.current = { version: at, view, px };
		});
	}, [decals, view, version, tx, ty, worldSize, px]);
	const mx = (props.width / px) * DECAL_MARGIN;
	const my = (props.height / px) * DECAL_MARGIN;
	return (
		<canvas
			ref={ref}
			data-usketch-ground-decals=""
			width={px + 2 * DECAL_MARGIN}
			height={px + 2 * DECAL_MARGIN}
			style={{
				position: "absolute",
				left: props.left - mx,
				top: props.top - my,
				width: props.width + 2 * mx,
				height: props.height + 2 * my,
			}}
		/>
	);
});
