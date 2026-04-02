import type { BoardStore } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useRef, useState } from "react";

interface IslandBlob {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
	groupId?: string;
}

function collectBlobs(store: BoardStore): IslandBlob[] {
	const blobs: IslandBlob[] = [];
	for (const [, shape] of store.getShapes()) {
		if (shape.type !== "island") continue;
		let groupId: string | undefined;
		const parentId = shape.parentId as string | undefined;
		if (parentId) {
			const parent = store.getShapes().get(parentId);
			if (parent?.type === "group" && parent._isIslandGroup) {
				groupId = parentId;
			}
		}
		blobs.push({
			id: shape.id,
			x: shape.x,
			y: shape.y,
			width: shape.width,
			height: shape.height,
			color: (shape.islandColor as string) ?? "#a8d5ba",
			groupId,
		});
	}
	return blobs;
}

export function IslandMetaballLayer({ store }: { store: BoardStore }) {
	const [blobs, setBlobs] = useState<IslandBlob[]>([]);
	const [viewport, setViewport] = useState(store.getViewport());
	const rafRef = useRef(0);

	const update = useCallback(() => {
		cancelAnimationFrame(rafRef.current);
		rafRef.current = requestAnimationFrame(() => {
			setBlobs(collectBlobs(store));
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

	// Group blobs by island-group
	const groups = new Map<string, IslandBlob[]>();
	const singles: IslandBlob[] = [];

	for (const blob of blobs) {
		if (blob.groupId) {
			if (!groups.has(blob.groupId)) {
				groups.set(blob.groupId, []);
			}
			groups.get(blob.groupId)?.push(blob);
		} else {
			singles.push(blob);
		}
	}

	const R = 24;

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				overflow: "hidden",
			}}
		>
			{/* Grouped islands: SVG metaball fusion */}
			{[...groups.entries()].map(([groupId, groupBlobs]) => {
				let minX = Infinity;
				let minY = Infinity;
				let maxX = -Infinity;
				let maxY = -Infinity;
				for (const b of groupBlobs) {
					minX = Math.min(minX, b.x);
					minY = Math.min(minY, b.y);
					maxX = Math.max(maxX, b.x + b.width);
					maxY = Math.max(maxY, b.y + b.height);
				}
				const pad = 40;
				const gx = minX - pad;
				const gy = minY - pad;
				const gw = maxX - minX + pad * 2;
				const gh = maxY - minY + pad * 2;

				const color = groupBlobs[0].color;
				const filterId = `island-merge-${groupId}`;

				return (
					<div
						key={groupId}
						style={{
							position: "absolute",
							left: gx * viewport.zoom + viewport.x,
							top: gy * viewport.zoom + viewport.y,
							width: gw * viewport.zoom,
							height: gh * viewport.zoom,
							pointerEvents: "none",
						}}
					>
						<svg
							width={gw * viewport.zoom}
							height={gh * viewport.zoom}
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
								{groupBlobs.map((blob) => (
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
					</div>
				);
			})}

			{/* Single islands: simple rounded background */}
			{singles.map((blob) => (
				<div
					key={blob.id}
					style={{
						position: "absolute",
						left: blob.x * viewport.zoom + viewport.x,
						top: blob.y * viewport.zoom + viewport.y,
						width: blob.width * viewport.zoom,
						height: blob.height * viewport.zoom,
						borderRadius: R * viewport.zoom,
						background: `linear-gradient(145deg, ${blob.color}cc, ${blob.color}88)`,
						boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
						pointerEvents: "none",
					}}
				/>
			))}
		</div>
	);
}
