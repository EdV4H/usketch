import type { Point } from "@edv4h/usketch-shared";
import type { ScreenSize } from "./viewport-moves.js";

export interface EdgePosition {
	/** バッジを置く画面座標。 */
	x: number;
	y: number;
	/** 画面中央から見た吹いた場所の向き (deg、右 = 0、時計回り)。 */
	angle: number;
	onScreen: boolean;
}

/**
 * 画面座標 `screen` が画面外なら、中央から見た方向で画面の縁 (padding 内側) に
 * 寄せた位置を返す。画面内ならその位置のまま。
 */
export function edgePosition(screen: Point, size: ScreenSize, padding = 40): EdgePosition {
	const cx = size.width / 2;
	const cy = size.height / 2;
	const dx = screen.x - cx;
	const dy = screen.y - cy;
	const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
	const onScreen =
		screen.x >= 0 && screen.x <= size.width && screen.y >= 0 && screen.y <= size.height;
	if (onScreen || (dx === 0 && dy === 0)) return { x: screen.x, y: screen.y, angle, onScreen };
	const halfW = Math.max(cx - padding, 1);
	const halfH = Math.max(cy - padding, 1);
	const scale = Math.min(
		dx !== 0 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY,
		dy !== 0 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY,
	);
	return { x: cx + dx * scale, y: cy + dy * scale, angle, onScreen };
}
