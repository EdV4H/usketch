import type { BoardStore, ShapeData, Viewport } from "@edv4h/usketch-shared";
import { computeMinimap, type MinimapResult, zoomBy } from "@edv4h/usketch-shared";
import { STOP_CANVAS_PROPAGATION } from "../stop-propagation.js";
import {
	ACCENT_DIM,
	MINI_BUTTON,
	PANEL_BG,
	PANEL_BLUR,
	PANEL_BORDER_RADIUS,
	TEXT_COLOR,
} from "../styles.js";

interface MinimapProps {
	store: BoardStore;
	shapes: ReadonlyMap<string, ShapeData>;
	viewport: Viewport;
	selection: ReadonlySet<string>;
	/** Left offset so the minimap clears the Controls dock. Default 8. */
	offsetLeft?: number;
}

const MAP_W = 140;
const MAP_H = 90;

export function Minimap({ store, shapes, viewport, selection, offsetLeft = 8 }: MinimapProps) {
	const shapeArr = Array.from(shapes.values());

	// viewport.x/y is a screen-space translate offset, not a world origin.
	const vpWorldX = -viewport.x / viewport.zoom;
	const vpWorldY = -viewport.y / viewport.zoom;
	const vpWorldW = window.innerWidth / viewport.zoom;
	const vpWorldH = window.innerHeight / viewport.zoom;

	const result: MinimapResult = computeMinimap({
		shapes: shapeArr,
		viewportWorld: { x: vpWorldX, y: vpWorldY, width: vpWorldW, height: vpWorldH },
		mapWidth: MAP_W,
		mapHeight: MAP_H,
		padding: 20,
		minSize: 2,
	});

	// Zoom about the screen center, matching the old TopBar zoom controls.
	// Discrete button → smooth by default (shared helper animates).
	const zoomAt = (factor: number) => zoomBy(store, factor);
	const resetZoom = () => store.animateViewportTo({ x: 0, y: 0, zoom: 1 });

	return (
		<div
			{...STOP_CANVAS_PROPAGATION}
			style={{
				position: "absolute",
				bottom: 8,
				left: offsetLeft,
				width: MAP_W,
				background: PANEL_BG,
				borderRadius: PANEL_BORDER_RADIUS,
				backdropFilter: PANEL_BLUR,
				pointerEvents: "auto",
				overflow: "hidden",
			}}
		>
			{/* Map area */}
			<div style={{ position: "relative", width: MAP_W, height: MAP_H, overflow: "hidden" }}>
				{/* Shapes as dots */}
				{result.rects.map((r) => (
					<div
						key={r.id}
						style={{
							position: "absolute",
							left: r.x,
							top: r.y,
							width: r.width,
							height: r.height,
							background: selection.has(r.id)
								? "rgba(99, 102, 241, 0.8)"
								: "rgba(255, 255, 255, 0.4)",
							borderRadius: 1,
						}}
					/>
				))}
				{/* Viewport rect */}
				{result.viewportRect && (
					<div
						style={{
							position: "absolute",
							left: result.viewportRect.x,
							top: result.viewportRect.y,
							width: result.viewportRect.width,
							height: result.viewportRect.height,
							border: `1px solid ${ACCENT_DIM}`,
							borderRadius: 2,
							boxSizing: "border-box",
						}}
					/>
				)}
			</div>

			{/* Zoom controls (旧 TopBar の ZoomControls をここへ集約) */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 4,
					padding: "4px 6px",
					borderTop: "1px solid rgba(255,255,255,0.08)",
				}}
			>
				<button
					type="button"
					title="ズームアウト"
					style={{ ...MINI_BUTTON, minWidth: 24 }}
					onClick={() => zoomAt(0.8)}
				>
					−
				</button>
				<button
					type="button"
					title="100% にリセット"
					onClick={resetZoom}
					style={{
						flex: 1,
						background: "transparent",
						border: "none",
						color: TEXT_COLOR,
						cursor: "pointer",
						fontFamily: "inherit",
						fontSize: 11,
						fontVariantNumeric: "tabular-nums",
					}}
				>
					{Math.round(viewport.zoom * 100)}%
				</button>
				<button
					type="button"
					title="ズームイン"
					style={{ ...MINI_BUTTON, minWidth: 24 }}
					onClick={() => zoomAt(1.25)}
				>
					+
				</button>
			</div>
		</div>
	);
}
