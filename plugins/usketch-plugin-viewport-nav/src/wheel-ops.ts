import type { BoardStore, CanvasWheelEvent } from "@edv4h/usketch-shared";
import type { WheelSensitivity } from "./viewport-nav-settings.js";

/** ホイール/トラックパッドのズーム係数の基準ステップ。
 * 既定感度(=1)で deltaY≈100 → factor≈exp(-0.1)≈0.905、deltaY≈-100 → ≈1.105 となり、
 * 従来の固定 0.9 / 1.1 とほぼ同じ体感になる。 */
export const ZOOM_STEP = 0.001;

/**
 * ホイールイベント 1 つをビューポートに反映する。
 * `Ctrl` / `Cmd`（トラックパッドのピンチ含む）はカーソル位置を中心にズーム、それ以外はパン。
 * 感度は呼び出し側がデバイスに応じて選んで渡す。
 */
export function applyWheelToViewport(
	store: Pick<BoardStore, "getViewport" | "zoomTo" | "panBy">,
	event: Pick<CanvasWheelEvent, "deltaX" | "deltaY" | "ctrlKey" | "metaKey" | "screenPoint">,
	sensitivity: WheelSensitivity,
): void {
	if (event.ctrlKey || event.metaKey) {
		// factor は deltaY の大きさに比例（トラックパッドのピンチも滑らか）
		const factor = Math.exp(-event.deltaY * ZOOM_STEP * sensitivity.zoom);
		store.zoomTo(store.getViewport().zoom * factor, event.screenPoint);
		return;
	}
	store.panBy(-event.deltaX * sensitivity.pan, -event.deltaY * sensitivity.pan);
}
