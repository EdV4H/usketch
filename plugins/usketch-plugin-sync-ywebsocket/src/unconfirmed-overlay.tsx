import type { BoardStore, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import type { SyncStatusTracker } from "./sync-status-tracker.js";

interface UnconfirmedOverlayProps {
	store: BoardStore;
	shapes: ShapeRegistry;
	viewport: Viewport;
	syncStatus: SyncStatusTracker;
}

const BADGE_FILL = "#dc2626";
const BADGE_RADIUS = 9;
const BADGE_OFFSET = 4;

/**
 * SVG overlay that draws a small red exclamation badge on the top-right corner
 * of any shape whose ID is in `syncStatus.snapshot.unconfirmedShapeIds` —
 * i.e. shapes that exist in the local Y.Doc but the server hasn't acknowledged.
 * The debug HUD uses the `⚠` glyph; here we render a circle + `!` so the badge
 * stays legible at small zoom levels where multi-codepoint emoji distort.
 *
 * This is purely diagnostic; clicks pass through to the underlying shape.
 */
export function UnconfirmedOverlay({
	store,
	shapes,
	viewport,
	syncStatus,
}: UnconfirmedOverlayProps) {
	const snapshot = useSyncExternalStore(
		(listener) => syncStatus.subscribe(listener),
		() => syncStatus.getSnapshot(),
		() => syncStatus.getSnapshot(),
	);

	// Only surface divergence after we've actually heard from the server at
	// least once. Pre-sync (loading / connecting on a cold start) every
	// IndexedDB-restored shape would look "unconfirmed" because we don't yet
	// know what the server holds — flagging them then would be noise.
	// We use `lastSyncedAt != null` rather than `state === "synced"` so a
	// later disconnection (offline edits, network drop) still surfaces
	// divergence: that's exactly when the user needs the warning.
	if (snapshot.lastSyncedAt === null) return null;
	if (snapshot.unconfirmedShapeIds.length === 0) return null;

	return (
		<svg
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>サーバ未同期 Shape</title>
			{snapshot.unconfirmedShapeIds.map((id) => (
				<UnconfirmedBadge key={id} store={store} shapes={shapes} viewport={viewport} shapeId={id} />
			))}
		</svg>
	);
}

function UnconfirmedBadge({
	store,
	shapes,
	viewport,
	shapeId,
}: {
	store: BoardStore;
	shapes: ShapeRegistry;
	viewport: Viewport;
	shapeId: string;
}) {
	const shape = store.getShape(shapeId);
	if (!shape) return null;

	// Use the shape definition's bounds when available, falling back to the
	// raw `x/y/width/height` for shapes without a registered type (e.g. legacy
	// shape types that disappeared after a refactor — the very case this
	// overlay was designed to surface).
	const def = shapes.get(shape.type);
	const bounds = def?.getBounds(shape) ?? {
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	};

	const cx = (bounds.x + bounds.width) * viewport.zoom + viewport.x + BADGE_OFFSET;
	const cy = bounds.y * viewport.zoom + viewport.y - BADGE_OFFSET;

	return (
		<g>
			<title>{`${shape.type} (${shapeId.slice(0, 8)}…) — サーバに存在しません`}</title>
			<circle cx={cx} cy={cy} r={BADGE_RADIUS} fill={BADGE_FILL} />
			<text
				x={cx}
				y={cy + 1}
				textAnchor="middle"
				dominantBaseline="middle"
				fontSize={11}
				fontWeight={700}
				fill="#ffffff"
				style={{ userSelect: "none" }}
			>
				!
			</text>
		</g>
	);
}
