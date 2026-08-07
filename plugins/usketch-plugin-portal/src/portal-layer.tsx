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

/**
 * Track a pointer drag on `window` until it ends. Cleans up on pointerup AND on
 * pointercancel / window blur, so an interrupted gesture (OS gesture, lost
 * capture, focus loss) never leaves listeners stuck updating the panel.
 */
function trackPointer(onMove: (ev: PointerEvent) => void): void {
	const end = () => {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", end);
		window.removeEventListener("pointercancel", end);
		window.removeEventListener("blur", end);
	};
	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", end);
	window.addEventListener("pointercancel", end);
	window.addEventListener("blur", end);
}

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

export interface PortalChromeProps {
	entry: PortalEntry;
	shared: boolean;
	/** true when the portal **holds** the shape (removed from canvas); see {@link restore}. */
	held: boolean;
	title: string;
	toggleShared: () => void;
	remove: () => void;
	/**
	 * Restore a held portal's shape to the canvas (present only when `held`).
	 * Held portals should offer this instead of a destructive close, since the
	 * portal holds the only copy of the shape.
	 */
	restore?: () => void;
	/** Spread onto the drag handle (header). */
	dragHandleProps: { onPointerDown: (e: React.PointerEvent) => void };
	/** Spread onto the resize grip. */
	resizeHandleProps: { onPointerDown: (e: React.PointerEvent) => void };
	/** Plugin-owned body (the re-rendered shape). Must be rendered. */
	children: React.ReactNode;
}
export type PortalChrome = (props: PortalChromeProps) => React.ReactElement;

const headerBtn: React.CSSProperties = {
	border: "none",
	background: "transparent",
	cursor: "pointer",
	fontSize: 13,
	lineHeight: 1,
	padding: 2,
};

/** Default portal panel chrome (overridable via the plugin's `components.Chrome`). */
export function DefaultPortalChrome(p: PortalChromeProps) {
	return (
		<div
			{...stopCanvas}
			style={{
				position: "fixed",
				left: p.entry.x,
				top: p.entry.y,
				width: p.entry.w,
				height: p.entry.h,
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
				onPointerDown={p.dragHandleProps.onPointerDown}
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
					{p.title}
				</span>
				<button
					type="button"
					title={p.shared ? "全員に共有中（クリックで個人に戻す）" : "個人（クリックで全員に共有）"}
					onPointerDown={(e) => e.stopPropagation()}
					onClick={p.toggleShared}
					style={headerBtn}
				>
					{p.shared ? "👥" : "🔒"}
				</button>
				{p.held ? (
					<button
						type="button"
						title="キャンバスに戻す"
						onPointerDown={(e) => e.stopPropagation()}
						onClick={p.restore}
						style={{ ...headerBtn, color: "#2563eb" }}
					>
						⤴
					</button>
				) : (
					<button
						type="button"
						title="閉じる"
						onPointerDown={(e) => e.stopPropagation()}
						onClick={p.remove}
						style={{ ...headerBtn, color: "#9ca3af" }}
					>
						✕
					</button>
				)}
			</div>
			<div style={{ flex: 1, minHeight: 0, position: "relative" }}>
				{p.children}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: resize grip */}
				<div
					onPointerDown={p.resizeHandleProps.onPointerDown}
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

function PortalPanel({
	entry,
	shared,
	held,
	shape,
	def,
	onUpdate,
	onRemove,
	onToggleShared,
	onRestore,
	Chrome,
}: {
	entry: PortalEntry;
	shared: boolean;
	held: boolean;
	shape: ShapeData;
	def: ReturnType<ShapeRegistry["get"]>;
	onUpdate: (id: string, patch: Partial<Pick<PortalEntry, "x" | "y" | "w" | "h">>) => void;
	onRemove: (id: string) => void;
	onToggleShared: (id: string, shared: boolean) => void;
	onRestore?: (entry: PortalEntry, shared: boolean) => void;
	Chrome: PortalChrome;
}) {
	const bodyH = Math.max(0, entry.h - PORTAL_HEADER_H);

	const startDrag = (e: React.PointerEvent) => {
		e.stopPropagation();
		e.preventDefault();
		const sx = e.clientX;
		const sy = e.clientY;
		const ox = entry.x;
		const oy = entry.y;
		trackPointer((ev) => {
			const x = clamp(ox + ev.clientX - sx, 0, window.innerWidth - entry.w);
			const y = clamp(oy + ev.clientY - sy, 0, window.innerHeight - entry.h);
			onUpdate(entry.id, { x, y });
		});
	};

	const startResize = (e: React.PointerEvent) => {
		e.stopPropagation();
		e.preventDefault();
		const sx = e.clientX;
		const sy = e.clientY;
		const ow = entry.w;
		const oh = entry.h;
		trackPointer((ev) => {
			const w = clamp(ow + ev.clientX - sx, 140, Math.max(140, window.innerWidth - entry.x));
			const h = clamp(oh + ev.clientY - sy, 100, Math.max(100, window.innerHeight - entry.y));
			onUpdate(entry.id, { w, h });
		});
	};

	return (
		<Chrome
			entry={entry}
			shared={shared}
			held={held}
			title={(shape as { label?: string }).label || shape.type}
			toggleShared={() => onToggleShared(entry.id, !shared)}
			remove={() => onRemove(entry.id)}
			restore={held && onRestore ? () => onRestore(entry, shared) : undefined}
			dragHandleProps={{ onPointerDown: startDrag }}
			resizeHandleProps={{ onPointerDown: startResize }}
		>
			<ShapeContent def={def} shape={shape} bodyW={entry.w} bodyH={bodyH} />
		</Chrome>
	);
}

export function PortalLayer({
	portalStore,
	store,
	shapes,
	Chrome = DefaultPortalChrome,
	onRestore,
}: {
	portalStore: PortalStore;
	store: BoardStore;
	shapes: ShapeRegistry;
	Chrome?: PortalChrome;
	/** Restore a held portal's shape to the canvas (undoable; provided by the plugin). */
	onRestore?: (entry: PortalEntry, shared: boolean) => void;
}) {
	const items = useSyncExternalStore(portalStore.subscribe, portalStore.getAll);
	// Re-render on any store mutation so pinned shapes reflect edits.
	const [, tick] = useReducer((n: number) => n + 1, 0);
	useEffect(() => store.subscribe(tick), [store]);

	// Drop **pin** portals whose target shape no longer exists. Held portals own
	// their shape snapshot (it isn't on the board), so they must never be dropped
	// here — that would lose the only copy.
	useEffect(() => {
		for (const { entry } of items) {
			if (!entry.shape && !store.getShape(entry.shapeId)) portalStore.remove(entry.id);
		}
	}, [items, store, portalStore]);

	return (
		<>
			{items.map(({ entry, shared }) => {
				const held = !!entry.shape;
				const shape = entry.shape ?? store.getShape(entry.shapeId);
				if (!shape) return null;
				return (
					<PortalPanel
						key={entry.id}
						entry={entry}
						shared={shared}
						held={held}
						shape={shape}
						def={shapes.get(shape.type)}
						onUpdate={portalStore.update}
						onRemove={portalStore.remove}
						onToggleShared={portalStore.setShared}
						onRestore={onRestore}
						Chrome={Chrome}
					/>
				);
			})}
		</>
	);
}
