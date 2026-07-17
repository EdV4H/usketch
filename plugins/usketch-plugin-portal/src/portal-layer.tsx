import type { BoardStore, BoundingBox, ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { useEffect, useReducer, useSyncExternalStore } from "react";
import { PORTAL_HEADER_H, type PortalEntry, type PortalStore } from "./portal-store.js";

// Keep panel pointer/click/wheel from reaching the canvas (which would pan/select).
// Children (e.g. a timer shape's buttons) still receive their events at the target
// first, so they keep working; this only stops bubbling up to the canvas.
const stopCanvas = {
	onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
	onWheel: (e: React.WheelEvent) => e.stopPropagation(),
	onContextMenu: (e: React.MouseEvent) => e.stopPropagation(),
} as const;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function ShapeContent({
	def,
	shape,
	bodyW,
	bodyH,
}: {
	def: ReturnType<ShapeRegistry["get"]>;
	shape: ShapeData;
	bodyW: number;
	bodyH: number;
}) {
	if (!def) return null;
	const b: BoundingBox = def.getBounds(shape);
	if (def.renderTarget === "html") {
		const k = Math.min(bodyW / Math.max(1, b.width), bodyH / Math.max(1, b.height));
		return (
			<div style={{ width: bodyW, height: bodyH, overflow: "hidden", position: "relative" }}>
				<div
					style={{
						width: b.width,
						height: b.height,
						transform: `scale(${k})`,
						transformOrigin: "top left",
					}}
				>
					{def.render(shape)}
				</div>
			</div>
		);
	}
	// SVG (default): viewBox does the world→box fit for us.
	return (
		<svg
			width={bodyW}
			height={bodyH}
			viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`}
			preserveAspectRatio="xMidYMid meet"
			aria-label="portal shape"
		>
			{def.render(shape)}
		</svg>
	);
}

function PortalPanel({
	entry,
	shared,
	shape,
	def,
	onUpdate,
	onRemove,
	onToggleShared,
}: {
	entry: PortalEntry;
	shared: boolean;
	shape: ShapeData;
	def: ReturnType<ShapeRegistry["get"]>;
	onUpdate: (id: string, patch: Partial<Pick<PortalEntry, "x" | "y" | "w" | "h">>) => void;
	onRemove: (id: string) => void;
	onToggleShared: (id: string, shared: boolean) => void;
}) {
	const bodyH = Math.max(0, entry.h - PORTAL_HEADER_H);

	const startDrag = (e: React.PointerEvent) => {
		e.stopPropagation();
		e.preventDefault();
		const sx = e.clientX;
		const sy = e.clientY;
		const ox = entry.x;
		const oy = entry.y;
		const move = (ev: PointerEvent) => {
			const x = clamp(ox + ev.clientX - sx, 0, window.innerWidth - entry.w);
			const y = clamp(oy + ev.clientY - sy, 0, window.innerHeight - entry.h);
			onUpdate(entry.id, { x, y });
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};

	const startResize = (e: React.PointerEvent) => {
		e.stopPropagation();
		e.preventDefault();
		const sx = e.clientX;
		const sy = e.clientY;
		const ow = entry.w;
		const oh = entry.h;
		const move = (ev: PointerEvent) => {
			const w = clamp(ow + ev.clientX - sx, 140, window.innerWidth - entry.x);
			const h = clamp(oh + ev.clientY - sy, 100, window.innerHeight - entry.y);
			onUpdate(entry.id, { w, h });
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};

	return (
		<div
			{...stopCanvas}
			style={{
				position: "fixed",
				left: entry.x,
				top: entry.y,
				width: entry.w,
				height: entry.h,
				display: "flex",
				flexDirection: "column",
				background: "#fff",
				border: "1px solid #d1d5db",
				borderRadius: 8,
				boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
				overflow: "hidden",
				pointerEvents: "auto",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<div
				onPointerDown={startDrag}
				style={{
					height: PORTAL_HEADER_H,
					flex: "0 0 auto",
					display: "flex",
					alignItems: "center",
					gap: 4,
					padding: "0 6px",
					background: "#f3f4f6",
					borderBottom: "1px solid #e5e7eb",
					cursor: "move",
					userSelect: "none",
				}}
			>
				<span
					style={{
						flex: 1,
						fontSize: 11,
						fontWeight: 600,
						color: "#374151",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{(shape as { label?: string }).label || shape.type}
				</span>
				<button
					type="button"
					title={shared ? "全員に共有中（クリックで個人に戻す）" : "個人（クリックで全員に共有）"}
					onClick={() => onToggleShared(entry.id, !shared)}
					style={headerBtn}
				>
					{shared ? "👥" : "🔒"}
				</button>
				<button
					type="button"
					title="閉じる"
					onClick={() => onRemove(entry.id)}
					style={{ ...headerBtn, color: "#9ca3af" }}
				>
					✕
				</button>
			</div>

			<div style={{ flex: 1, minHeight: 0, position: "relative" }}>
				<ShapeContent def={def} shape={shape} bodyW={entry.w} bodyH={bodyH} />
				{/* biome-ignore lint/a11y/noStaticElementInteractions: resize grip */}
				<div
					onPointerDown={startResize}
					style={{
						position: "absolute",
						right: 0,
						bottom: 0,
						width: 14,
						height: 14,
						cursor: "nwse-resize",
						background:
							"linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.25) 60%, transparent 60%)",
					}}
				/>
			</div>
		</div>
	);
}

const headerBtn: React.CSSProperties = {
	border: "none",
	background: "transparent",
	cursor: "pointer",
	fontSize: 13,
	lineHeight: 1,
	padding: 2,
};

export function PortalLayer({
	portalStore,
	store,
	shapes,
}: {
	portalStore: PortalStore;
	store: BoardStore;
	shapes: ShapeRegistry;
}) {
	const items = useSyncExternalStore(portalStore.subscribe, portalStore.getAll);
	// Re-render on any store mutation so pinned shapes reflect edits.
	const [, tick] = useReducer((n: number) => n + 1, 0);
	useEffect(() => store.subscribe(tick), [store]);

	// Drop portals whose target shape no longer exists.
	useEffect(() => {
		for (const { entry } of items) {
			if (!store.getShape(entry.shapeId)) portalStore.remove(entry.id);
		}
	}, [items, store, portalStore]);

	return (
		<>
			{items.map(({ entry, shared }) => {
				const shape = store.getShape(entry.shapeId);
				if (!shape) return null;
				return (
					<PortalPanel
						key={entry.id}
						entry={entry}
						shared={shared}
						shape={shape}
						def={shapes.get(shape.type)}
						onUpdate={portalStore.update}
						onRemove={portalStore.remove}
						onToggleShared={portalStore.setShared}
					/>
				);
			})}
		</>
	);
}
