import type { TransientObject } from "@edv4h/usketch-shared";
import type { CSSProperties } from "react";
import type { PlacementAnimation, PlacementPreset } from "./types.js";

export const PLACEMENT_TRANSIENT_TYPE = "card-placement";

export type SlamWeight = "light" | "medium" | "heavy";

/** keyframe ベースのプリセット（名前 + 既定再生時間）。 */
const PRESET_KEYFRAMES: Record<
	"deal" | "drop" | "bounce",
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

/**
 * Slam（ドン！）の重み別パラメータ。`Card Animations.dc.html` の light/medium/heavy
 * の比率を踏襲（重いほど大きく・濃く・遅い）。サイズはカード寸法に対する係数で表す。
 */
const SLAM_PARAMS: Record<
	SlamWeight,
	{
		durationMs: number;
		lift: number; // 着地前に一瞬持ち上がる量(px)
		liftScale: number; // 持ち上がり時のスケール（手前=大きく）
		ring: number; // カード最大辺に対するリング径の係数
		shadow: number; // 接地シャドウ径の係数
		shadowOpacity: number;
		spray: number; // 飛沫の到達距離（カード最大辺に対する係数）
		particle: number; // 粒の基準サイズ(px)
	}
> = {
	// design 比 dur 2.3 : 3.3 : 4.6 ≈ 0.5 : 0.72 : 1.0 を一発再生用に圧縮。
	// lift / liftScale は design の --lift(52/94/142) の比を踏襲。
	light: {
		durationMs: 380,
		lift: 8,
		liftScale: 1.07,
		ring: 0.95,
		shadow: 1.0,
		shadowOpacity: 0.28,
		spray: 0.55,
		particle: 5,
	},
	medium: {
		durationMs: 560,
		lift: 16,
		liftScale: 1.13,
		ring: 1.25,
		shadow: 1.25,
		shadowOpacity: 0.5,
		spray: 0.85,
		particle: 6,
	},
	heavy: {
		durationMs: 780,
		lift: 26,
		liftScale: 1.2,
		ring: 1.6,
		shadow: 1.6,
		shadowOpacity: 0.62,
		spray: 1.2,
		particle: 7,
	},
};

/** transient.emit に載せる解決済みアニメ情報。 */
export type ResolvedPlacement =
	| { kind: "css"; name: string; durationMs: number; easing: string }
	| { kind: "slam"; weight: SlamWeight; durationMs: number };

function isSlam(preset: PlacementPreset): preset is `slam-${SlamWeight}` {
	return preset === "slam-light" || preset === "slam-medium" || preset === "slam-heavy";
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
		return {
			kind: "css",
			name: anim.keyframes,
			durationMs: anim.durationMs,
			easing: anim.easing ?? "ease-out",
		};
	}
	if (anim.preset === "none") return null;
	if (isSlam(anim.preset)) {
		const weight = anim.preset.slice(5) as SlamWeight;
		return { kind: "slam", weight, durationMs: SLAM_PARAMS[weight].durationMs };
	}
	return { kind: "css", ...PRESET_KEYFRAMES[anim.preset] };
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
		/* カード本体: 一瞬持ち上がってから加速して着地（ズドン）→ フェードして実カードを見せる */
		@keyframes usketch-slam-card {
			0%   { opacity: 0; transform: translateY(var(--ly)) scale(var(--ls)); }
			10%  { opacity: 0.92; }
			30%  { transform: translateY(var(--ly)) scale(var(--ls)); animation-timing-function: cubic-bezier(0.55, 0, 0.9, 0.25); }
			40%  { transform: translateY(0) scale(1); opacity: 0.92; }
			72%  { opacity: 0.4; }
			100% { opacity: 0; transform: translateY(0) scale(1); }
		}
		/* 以下の衝撃エフェクトは着地（≈40%）に合わせて発火 */
		@keyframes usketch-slam-ring {
			0%, 36% { opacity: 0; transform: scale(0.4); }
			44%     { opacity: 0.85; transform: scale(0.55); }
			100%    { opacity: 0; transform: scale(1.6); }
		}
		@keyframes usketch-slam-shadow {
			0%   { opacity: 0.3; transform: scale(1.55); }
			30%  { opacity: 0.35; transform: scale(1.6); }
			40%  { opacity: 1; transform: scale(0.86); }
			70%  { opacity: 0.7; transform: scale(1); }
			100% { opacity: 0; transform: scale(1.4); }
		}
		@keyframes usketch-slam-splash {
			0%, 38% { opacity: 0; transform: translate(0, 0) scale(0.4); }
			46%     { opacity: 0.9; transform: translate(calc(var(--tx) * 0.45), calc(var(--ty) * 0.45)) scale(1); }
			100%    { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.7); }
		}
	`;
	document.head.appendChild(style);
}

/** 8 方向の放射状飛沫。 */
const SPRAY_DIRS = [0, 45, 90, 135, 180, 225, 270, 315];

/** 「ドン！」着地の衝撃エフェクト: 接地シャドウ + 衝撃リング + 放射状飛沫。 */
function SlamBurst({ obj }: { obj: TransientObject }) {
	const width = (obj.data.width as number) ?? 120;
	const height = (obj.data.height as number) ?? 168;
	const weight = (obj.data.slam as SlamWeight) ?? "medium";
	const durationMs = (obj.data.durationMs as number) ?? SLAM_PARAMS[weight].durationMs;
	const p = SLAM_PARAMS[weight];
	const cardMax = Math.max(width, height);
	const ringSize = cardMax * p.ring;
	const shadowSize = cardMax * p.shadow;
	const dist = cardMax * p.spray;

	const circle = (size: number, style: CSSProperties) => ({
		position: "absolute" as const,
		left: -size / 2,
		top: -size / 2,
		width: size,
		height: size,
		borderRadius: "50%",
		pointerEvents: "none" as const,
		...style,
	});

	// カード本体: 一瞬持ち上がって（手前=大きく）から加速して着地するシルエット。
	// 実カードの上に重なり、着地後にフェードして実カードを見せる。
	const cardStyle: Record<string, string | number> = {
		position: "absolute",
		left: -width / 2,
		top: -height / 2,
		width,
		height,
		borderRadius: 12,
		boxSizing: "border-box",
		background: "linear-gradient(160deg, rgba(255,255,255,0.5), rgba(238,240,245,0.4))",
		border: "1px solid rgba(16,18,40,0.16)",
		boxShadow: "0 14px 34px rgba(16,18,40,0.3)",
		pointerEvents: "none",
		animation: `usketch-slam-card ${durationMs}ms ease-out forwards`,
		"--ly": `${-p.lift}px`,
		"--ls": p.liftScale,
	};

	return (
		<div style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
			{/* 接地シャドウ（持ち上がり時は大きく淡く→着地でキュッと締まる） */}
			<div
				style={circle(shadowSize, {
					background: `radial-gradient(circle, rgba(16,18,40,${p.shadowOpacity}), rgba(16,18,40,0) 66%)`,
					filter: "blur(7px)",
					opacity: 0,
					animation: `usketch-slam-shadow ${durationMs}ms ease-in-out forwards`,
				})}
			/>
			{/* カード本体（持ち上がり→ズドン） */}
			<div style={cardStyle as CSSProperties} />
			{/* 衝撃リング */}
			<div
				style={circle(ringSize, {
					border: "2px solid rgba(16,18,40,0.32)",
					animation: `usketch-slam-ring ${durationMs}ms ease-out forwards`,
				})}
			/>
			{/* 放射状の飛沫 */}
			{SPRAY_DIRS.map((deg, i) => {
				const a = (deg * Math.PI) / 180;
				const tx = Math.cos(a) * dist;
				const ty = Math.sin(a) * dist;
				const size = i % 2 === 0 ? p.particle + 1 : p.particle - 1;
				const style: Record<string, string | number> = {
					...circle(size, {
						background: "#16182a",
						animation: `usketch-slam-splash ${durationMs}ms ease-out forwards`,
					}),
					"--tx": `${tx}px`,
					"--ty": `${ty}px`,
				};
				return <div key={`spray-${deg}`} style={style as CSSProperties} />;
			})}
		</div>
	);
}

/**
 * 配置アニメの transient 描画。`slam` 系は衝撃エフェクト、それ以外はカードのシルエット
 * （角丸の発光枠）を着地位置に重ね、指定 keyframes で再生して fade out する。
 * いずれも永続データ / Undo には触れない。
 */
export function PlacementEffect({ obj }: { obj: TransientObject }) {
	if (obj.data.slam) return <SlamBurst obj={obj} />;

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
