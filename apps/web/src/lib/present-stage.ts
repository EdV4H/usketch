/**
 * プレゼン編集モードのステージ矩形を計算する。
 *
 * - 左: サイドバー (220 + 12*2 = 244px)
 * - 上: モード pill (64px)
 * - 下: ページャー + Toolbar 用の余白 (120px)
 * - 最大横幅 1100px、16:9 aspect
 *
 * Canvas コンテナサイズに適用することで、Canvas 自体が縮退する。
 * SlideNavigator 側の viewport fit もこの矩形に対して行う。
 */

export const STAGE_SIDEBAR_WIDTH = 220;
export const STAGE_SIDEBAR_MARGIN = 12;
export const STAGE_SIDEBAR_RESERVED = STAGE_SIDEBAR_WIDTH + STAGE_SIDEBAR_MARGIN * 2;
export const STAGE_TOP_RESERVED = 64;
export const STAGE_BOTTOM_RESERVED = 120;
export const STAGE_SIDE_PADDING = 30;
export const STAGE_MAX_WIDTH = 1100;
export const STAGE_ASPECT = 9 / 16;

export interface StageRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export function computePresentStage(win: { width: number; height: number }): StageRect {
	const available = {
		width: Math.max(100, win.width - STAGE_SIDEBAR_RESERVED - STAGE_SIDE_PADDING * 2),
		height: Math.max(
			100,
			win.height - STAGE_TOP_RESERVED - STAGE_SIDE_PADDING - STAGE_BOTTOM_RESERVED,
		),
	};
	let width = Math.min(available.width, STAGE_MAX_WIDTH);
	let height = width * STAGE_ASPECT;
	if (height > available.height) {
		height = available.height;
		width = height / STAGE_ASPECT;
	}
	const left = STAGE_SIDEBAR_RESERVED + STAGE_SIDE_PADDING + (available.width - width) / 2;
	const top = STAGE_TOP_RESERVED + STAGE_SIDE_PADDING + (available.height - height) / 2;
	return { left, top, width, height };
}
