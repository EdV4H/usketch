import { useSyncExternalStore } from "react";

export interface OverlayColors {
	/** 選択枠・ハンドルの線色。CSS 変数（例 `var(--colors-primary)`）も可。 */
	strokeColor: string;
	/** リサイズ/回転ハンドルの塗り色。 */
	handleFillColor: string;
}

const DEFAULTS: OverlayColors = { strokeColor: "#2680eb", handleFillColor: "#ffffff" };

// このプラグインの drag-state / marquee-state と同様、モジュールレベルの共有状態。
let colors: OverlayColors = { ...DEFAULTS };
const listeners = new Set<() => void>();

export function getOverlayColors(): OverlayColors {
	return colors;
}

export function setOverlayColors(patch: Partial<OverlayColors> | undefined): void {
	if (!patch) return;
	const next = { ...colors };
	if (patch.strokeColor != null) next.strokeColor = patch.strokeColor;
	if (patch.handleFillColor != null) next.handleFillColor = patch.handleFillColor;
	colors = next;
	for (const l of listeners) l();
}

/** 既定色へ戻す（プラグイン teardown 用、StrictMode 再マウント時の漏れ防止）。 */
export function resetOverlayColors(): void {
	colors = { ...DEFAULTS };
	for (const l of listeners) l();
}

export function subscribeOverlayColors(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** React コンポーネントから現在の色を購読する。 */
export function useOverlayColors(): OverlayColors {
	return useSyncExternalStore(subscribeOverlayColors, getOverlayColors, getOverlayColors);
}
