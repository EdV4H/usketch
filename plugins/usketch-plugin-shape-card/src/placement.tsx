import type { TransientObject } from "@edv4h/usketch-shared";
import type { PlacementAnimation, PlacementPreset } from "./types.js";

export const PLACEMENT_TRANSIENT_TYPE = "card-placement";

/** プリセットごとの keyframes 名と既定再生時間。 */
const PRESET_KEYFRAMES: Record<
	Exclude<PlacementPreset, "none">,
	{ name: string; durationMs: number; easing: string }
> = {
	deal: { name: "usketch-card-deal", durationMs: 350, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" },
	drop: { name: "usketch-card-drop", durationMs: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
	bounce: {
		name: "usketch-card-bounce",
		durationMs: 450,
		easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
	},
};

/** transient.emit に載せる解決済みアニメ情報。 */
export interface ResolvedPlacement {
	name: string;
	durationMs: number;
	easing: string;
}

/**
 * card-type 個別 → プラグイン既定の順で配置アニメを解決する。
 * `none` または該当なしの場合は null（＝アニメを出さない）。
 */
export function resolvePlacementAnimation(
	cardTypeAnim: PlacementAnimation | undefined,
	pluginDefault: PlacementAnimation | undefined,
): ResolvedPlacement | null {
	const anim = cardTypeAnim ?? pluginDefault ?? { preset: "drop" };
	if ("keyframes" in anim) {
		return { name: anim.keyframes, durationMs: anim.durationMs, easing: anim.easing ?? "ease-out" };
	}
	if (anim.preset === "none") return null;
	return PRESET_KEYFRAMES[anim.preset];
}

let styleInjected = false;
/** プリセット keyframes を一度だけ document.head に注入する（ripple と同じ手法）。 */
export function injectPlacementStyles() {
	if (styleInjected || typeof document === "undefined") return;
	styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes usketch-card-deal {
			0%   { transform: translate(-40px, -24px) rotate(-10deg) scale(0.92); opacity: 0.0; }
			60%  { opacity: 0.55; }
			100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0; }
		}
		@keyframes usketch-card-drop {
			0%   { transform: translateY(-24px) scale(1.12); opacity: 0.0; }
			55%  { opacity: 0.55; }
			100% { transform: translateY(0) scale(1); opacity: 0; }
		}
		@keyframes usketch-card-bounce {
			0%   { transform: scale(0.6); opacity: 0.0; }
			50%  { transform: scale(1.12); opacity: 0.5; }
			75%  { transform: scale(0.96); opacity: 0.3; }
			100% { transform: scale(1); opacity: 0; }
		}
	`;
	document.head.appendChild(style);
}

/**
 * 配置アニメの transient 描画。カードのシルエット（角丸の発光枠）を着地位置に重ね、
 * 指定 keyframes で再生して fade out する。永続データ / Undo には触れない。
 */
export function PlacementEffect({ obj }: { obj: TransientObject }) {
	const width = (obj.data.width as number) ?? 120;
	const height = (obj.data.height as number) ?? 168;
	const name = (obj.data.name as string) ?? "usketch-card-drop";
	const durationMs = (obj.data.durationMs as number) ?? 320;
	const easing = (obj.data.easing as string) ?? "ease-out";
	const accent = (obj.data.accent as string) ?? "rgba(79, 140, 255, 0.9)";

	return (
		<div
			style={{
				position: "absolute",
				left: -width / 2,
				top: -height / 2,
				width,
				height,
				borderRadius: 10,
				boxSizing: "border-box",
				border: `2px solid ${accent}`,
				boxShadow: `0 0 16px ${accent}`,
				animation: `${name} ${durationMs}ms ${easing} forwards`,
				pointerEvents: "none",
			}}
		/>
	);
}
