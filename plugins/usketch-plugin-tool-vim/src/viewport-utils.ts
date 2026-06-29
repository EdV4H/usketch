import type { BoardStore, Point } from "@edv4h/usketch-shared";

/** ビューポート（キャンバス）のサイズ。テスト等で window が無い場合は既定値。 */
export function getScreenSize(): { width: number; height: number } {
	if (typeof window === "undefined") return { width: 1280, height: 720 };
	return { width: window.innerWidth, height: window.innerHeight };
}

/** 画面中央に対応する world 座標。 */
export function screenCenterWorld(store: BoardStore): Point {
	const { width, height } = getScreenSize();
	const vp = store.getViewport();
	return {
		x: (width / 2 - vp.x) / vp.zoom,
		y: (height / 2 - vp.y) / vp.zoom,
	};
}

/** world 座標 `target` が画面中央に来るようビューポートを移動する。 */
export function centerViewportOn(store: BoardStore, target: Point): void {
	const { width, height } = getScreenSize();
	const vp = store.getViewport();
	store.setViewport({
		x: width / 2 - target.x * vp.zoom,
		y: height / 2 - target.y * vp.zoom,
		zoom: vp.zoom,
	});
}
