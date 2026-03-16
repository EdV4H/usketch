import type { ShapeData, Viewport } from "@edv4h/usketch-shared";
import { ACCENT_DIM, PANEL_BG, PANEL_BLUR, PANEL_BORDER_RADIUS } from "../styles.js";

interface MinimapProps {
	shapes: ReadonlyMap<string, ShapeData>;
	viewport: Viewport;
	selection: ReadonlySet<string>;
}

const MAP_W = 140;
const MAP_H = 90;
const PAD = 20;

export function Minimap({ shapes, viewport, selection }: MinimapProps) {
	const shapeArr = Array.from(shapes.values());

	// Compute world bounds (start with viewport)
	const vpRight = viewport.x + window.innerWidth / viewport.zoom;
	const vpBottom = viewport.y + window.innerHeight / viewport.zoom;
	let minX = viewport.x;
	let minY = viewport.y;
	let maxX = vpRight;
	let maxY = vpBottom;

	for (const s of shapeArr) {
		if (s.x < minX) minX = s.x;
		if (s.y < minY) minY = s.y;
		if (s.x + s.width > maxX) maxX = s.x + s.width;
		if (s.y + s.height > maxY) maxY = s.y + s.height;
	}

	const worldW = maxX - minX + PAD * 2;
	const worldH = maxY - minY + PAD * 2;
	const scale = Math.min(MAP_W / worldW, MAP_H / worldH);

	const toMapX = (wx: number) => (wx - minX + PAD) * scale;
	const toMapY = (wy: number) => (wy - minY + PAD) * scale;

	// Viewport rect in minimap
	const vx = toMapX(viewport.x);
	const vy = toMapY(viewport.y);
	const vw = (window.innerWidth / viewport.zoom) * scale;
	const vh = (window.innerHeight / viewport.zoom) * scale;

	return (
		<div
			style={{
				position: "absolute",
				bottom: 8,
				left: 8,
				width: MAP_W,
				height: MAP_H,
				background: PANEL_BG,
				borderRadius: PANEL_BORDER_RADIUS,
				backdropFilter: PANEL_BLUR,
				pointerEvents: "auto",
				overflow: "hidden",
			}}
		>
			{/* Shapes as dots */}
			{shapeArr.map((s) => (
				<div
					key={s.id}
					style={{
						position: "absolute",
						left: toMapX(s.x),
						top: toMapY(s.y),
						width: Math.max(2, s.width * scale),
						height: Math.max(2, s.height * scale),
						background: selection.has(s.id)
							? "rgba(99, 102, 241, 0.8)"
							: "rgba(255, 255, 255, 0.4)",
						borderRadius: 1,
					}}
				/>
			))}
			{/* Viewport rect */}
			<div
				style={{
					position: "absolute",
					left: vx,
					top: vy,
					width: vw,
					height: vh,
					border: `1px solid ${ACCENT_DIM}`,
					borderRadius: 2,
					boxSizing: "border-box",
				}}
			/>
		</div>
	);
}
