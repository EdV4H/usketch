import type { BoardStore } from "@edv4h/usketch-shared";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { getIslandElevation, liftedShapeElevations } from "./island-elevation.js";
import type { IslandShapeData } from "./types.js";

interface IslandBlob {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
	/** World units (0 = flat). */
	elevation: number;
	groupId?: string;
}

/** Islands that render as one block: fused metaball when `blobs.length > 1`. */
interface IslandCluster {
	key: string;
	elevation: number;
	blobs: IslandBlob[];
}

const R = 24;
/** Screen px between the stacked side slices of a raised block. */
const SLICE_GAP_PX = 4;
const MAX_SLICES = 24;

function collectBlobs(store: BoardStore): IslandBlob[] {
	const blobs: IslandBlob[] = [];
	for (const [, shape] of store.getShapes()) {
		if (shape.type !== "island") continue;
		const data = shape as IslandShapeData;
		let groupId: string | undefined;
		const parentId = data.parentId as string | undefined;
		if (parentId) {
			const parent = store.getShapes().get(parentId) as IslandShapeData | undefined;
			if (parent?.type === "group" && parent._isIslandGroup) {
				groupId = parentId;
			}
		}
		blobs.push({
			id: data.id,
			x: data.x,
			y: data.y,
			width: data.width,
			height: data.height,
			color: data.islandColor ?? "#a8d5ba",
			elevation: getIslandElevation(data),
			groupId,
		});
	}
	return blobs;
}

/**
 * Touching islands (an island-group) fuse only with members of the SAME elevation —
 * different heights stay separate blocks so the step between them stays visible.
 * Sorted low → high so the flat view paints higher ground on top.
 */
export function clusterBlobs(blobs: readonly IslandBlob[]): IslandCluster[] {
	const clusters = new Map<string, IslandCluster>();
	for (const blob of blobs) {
		const key = blob.groupId ? `${blob.groupId}@${blob.elevation}` : blob.id;
		let cluster = clusters.get(key);
		if (!cluster) {
			cluster = { key, elevation: blob.elevation, blobs: [] };
			clusters.set(key, cluster);
		}
		cluster.blobs.push(blob);
	}
	return [...clusters.values()].sort((a, b) => a.elevation - b.elevation);
}

/** z offsets (screen px) of the side slices between the ground and a top at `liftPx`. */
export function sliceDepths(liftPx: number): number[] {
	if (!(liftPx > 0)) return [];
	const count = Math.min(MAX_SLICES, Math.max(1, Math.ceil(liftPx / SLICE_GAP_PX)));
	const depths: number[] = [];
	for (let i = 0; i < count; i++) depths.push((liftPx * i) / count);
	return depths;
}

/** The cliff color: the island color darkened. */
function sideColor(color: string): string {
	return `color-mix(in srgb, ${color} 62%, #2b2118)`;
}

/** Ground shadow of a raised block: longer and darker the higher it stands. */
function groundShadow(elevation: number, zoom: number): string {
	const offset = (4 + elevation * 0.12) * zoom;
	const blur = (12 + elevation * 0.25) * zoom;
	const alpha = Math.min(0.35, 0.12 + elevation / 1000);
	return `0 ${offset}px ${blur}px rgba(0,0,0,${alpha})`;
}

/**
 * Mode 7 lifts the members of a raised island onto its top. The DOM shape layer
 * renders shapes as flat siblings, so each member gets an individual-transform
 * `translate` z (composes with its rotation `transform`) and the shape list keeps the
 * 3D context. Scoped to the Mode 7 stage, so the flat board is untouched.
 */
function liftRules(lifts: ReadonlyMap<string, number>, zoom: number): string {
	if (lifts.size === 0) return "";
	const stage = '[data-mode7-stage="on"] [data-layer="shapes"]';
	let css = `${stage}{transform-style:preserve-3d}`;
	for (const [id, elevation] of lifts) {
		const safe = id.replace(/["\\]/g, "");
		css += `${stage}>[data-shape-id="${safe}"]{translate:0 0 ${Math.round(elevation * zoom * 100) / 100}px}`;
	}
	return css;
}

function ClusterBlock({
	cluster,
	viewport,
}: {
	cluster: IslandCluster;
	viewport: { x: number; y: number; zoom: number };
}) {
	const { blobs, elevation } = cluster;
	const zoom = viewport.zoom;
	const fused = blobs.length > 1;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const b of blobs) {
		minX = Math.min(minX, b.x);
		minY = Math.min(minY, b.y);
		maxX = Math.max(maxX, b.x + b.width);
		maxY = Math.max(maxY, b.y + b.height);
	}
	const pad = fused ? 40 : 0;
	const gx = minX - pad;
	const gy = minY - pad;
	const gw = maxX - minX + pad * 2;
	const gh = maxY - minY + pad * 2;

	const color = blobs[0].color;
	const lift = elevation * zoom;
	const side = sideColor(color);

	// One footprint rect per member, in the block's local screen px.
	const footprint = (b: IslandBlob) => ({
		position: "absolute" as const,
		left: (b.x - gx) * zoom,
		top: (b.y - gy) * zoom,
		width: b.width * zoom,
		height: b.height * zoom,
		borderRadius: R * zoom,
	});

	let top: ReactNode;
	if (fused) {
		const filterId = `island-merge-${cluster.key.replace(/[^\w-]/g, "_")}`;
		top = (
			<svg
				width={gw * zoom}
				height={gh * zoom}
				viewBox={`0 0 ${gw} ${gh}`}
				style={{ display: "block", overflow: "visible" }}
			>
				<defs>
					<filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
						<feColorMatrix
							in="blur"
							type="matrix"
							values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
							result="metaball"
						/>
						<feComposite in="SourceGraphic" in2="metaball" operator="atop" />
					</filter>
				</defs>
				<g
					filter={`url(#${filterId})`}
					style={{
						filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.12)) drop-shadow(0 0 12px ${color}66)`,
					}}
				>
					{blobs.map((blob) => (
						<rect
							key={blob.id}
							x={blob.x - gx}
							y={blob.y - gy}
							width={blob.width}
							height={blob.height}
							rx={R}
							ry={R}
							fill={color}
							fillOpacity={0.8}
							stroke={color}
							strokeWidth={2}
						/>
					))}
				</g>
			</svg>
		);
	} else {
		const b = blobs[0];
		// Flat view: a darker bottom edge reads as the block's thickness.
		const edge = elevation > 0 ? Math.min(12, 2 + elevation * 0.06) * zoom : 0;
		top = (
			<div
				style={{
					...footprint(b),
					background: `linear-gradient(145deg, ${b.color}cc, ${b.color}88)`,
					boxShadow: elevation > 0 ? `inset 0 -${edge}px 0 ${side}` : "0 4px 16px rgba(0,0,0,0.1)",
				}}
			/>
		);
	}

	return (
		<div
			data-island-block={cluster.key}
			data-island-elevation={elevation}
			style={{
				position: "absolute",
				left: gx * zoom + viewport.x,
				top: gy * zoom + viewport.y,
				width: gw * zoom,
				height: gh * zoom,
				pointerEvents: "none",
				// The block's faces sit at different depths: real 3D under the Mode 7 tilt,
				// a flat stack (top painted last) on the plain board.
				transformStyle: "preserve-3d",
			}}
		>
			{elevation > 0 && (
				<>
					{/* Ground footprint (z = 0) carries the cast shadow. */}
					{blobs.map((b) => (
						<div
							key={`ground-${b.id}`}
							style={{
								...footprint(b),
								background: side,
								boxShadow: groundShadow(elevation, zoom),
							}}
						/>
					))}
					{/* Cliff: stacked slices between the ground and the top. */}
					{sliceDepths(lift).map((z) =>
						blobs.map((b) => (
							<div
								key={`side-${b.id}-${z}`}
								style={{
									...footprint(b),
									background: side,
									transform: `translateZ(${z}px)`,
								}}
							/>
						)),
					)}
				</>
			)}
			<div
				style={{
					position: "absolute",
					inset: 0,
					transform: lift > 0 ? `translateZ(${lift}px)` : undefined,
					transformStyle: "preserve-3d",
				}}
			>
				{top}
			</div>
		</div>
	);
}

export function IslandMetaballLayer({ store }: { store: BoardStore }) {
	const [blobs, setBlobs] = useState<IslandBlob[]>([]);
	const [lifts, setLifts] = useState<ReadonlyMap<string, number>>(new Map());
	const [viewport, setViewport] = useState(store.getViewport());
	const rafRef = useRef(0);

	const update = useCallback(() => {
		cancelAnimationFrame(rafRef.current);
		rafRef.current = requestAnimationFrame(() => {
			setBlobs(collectBlobs(store));
			setLifts(liftedShapeElevations(store));
			setViewport(store.getViewport());
		});
	}, [store]);

	useEffect(() => {
		update();
		const unsub = store.subscribe(update);
		return () => {
			unsub();
			cancelAnimationFrame(rafRef.current);
		};
	}, [store, update]);

	if (blobs.length === 0) return null;

	const css = liftRules(lifts, viewport.zoom);

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				// No overflow clip here: it would flatten the blocks under the Mode 7 tilt
				// (the canvas container already clips).
				transformStyle: "preserve-3d",
			}}
		>
			{css && <style>{css}</style>}
			{clusterBlobs(blobs).map((cluster) => (
				<ClusterBlock key={cluster.key} cluster={cluster} viewport={viewport} />
			))}
		</div>
	);
}
