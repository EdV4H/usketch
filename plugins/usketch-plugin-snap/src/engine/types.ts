import type { ShapeData } from "@edv4h/usketch-shared";

export type SnapEdge = "min" | "center" | "max";

export interface SnapPoint {
	value: number;
	sourceShapeId: string;
	edge: SnapEdge;
}

export interface SnapIndicator {
	x: number;
	y: number;
	edge: SnapEdge;
}

export interface SnapLine {
	axis: "x" | "y";
	position: number;
	from: number;
	to: number;
	movingEdge: SnapEdge;
	candidateEdge: SnapEdge;
	indicators: SnapIndicator[];
}

/** One equalized gap to visualize, along the snap axis. */
export interface GapSegment {
	/** Along-axis start coordinate of the gap. */
	start: number;
	/** Along-axis end coordinate of the gap. */
	end: number;
	/** Cross-axis coordinate the gap indicator is drawn at (mid of the shared band). */
	cross: number;
}

/**
 * An equal-spacing (distribution) guide: a set of gaps of the same `length` on
 * one axis that are highlighted together (the reference gap(s) + the newly
 * created one). Drawn as tick-capped segments so equal spacing reads at a glance.
 */
export interface SpacingGuide {
	axis: "x" | "y";
	/** The equalized gap length (world units). */
	length: number;
	segments: GapSegment[];
}

export interface SnapResult {
	dx: number;
	dy: number;
	/** Which edge of the moving box matched on the X axis (null if no x snap) */
	xEdge: SnapEdge | null;
	/** Which edge of the moving box matched on the Y axis (null if no y snap) */
	yEdge: SnapEdge | null;
	lines: SnapLine[];
	/**
	 * Equal-spacing (distribution) guides for this snap. Optional for backward
	 * compatibility — `calculateSnap` always sets it (possibly empty), but
	 * `undefined` is treated as an empty list by consumers.
	 */
	gaps?: SpacingGuide[];
}

export interface GuideStyle {
	color: string;
	dash: string;
	strokeWidth: number;
	indicatorRadius: number;
	diamondSize: number;
}

/**
 * Alt(Option) キー押下中の挙動。
 * - `"suppress"`（既定・従来）: 押下中は無条件にスナップ抑止。
 * - `"invert"`: 押下中は `enabled` を一時反転（無効時に一時有効、有効時に一時無効）。
 */
export type AltBehavior = "suppress" | "invert";

export interface SnapSettings {
	enabled: boolean;
	threshold: number;
	edgeSnap: boolean;
	centerSnap: boolean;
	/**
	 * Equal-spacing / distribution snapping (gap duplication + center-in-gap).
	 * Optional for backward compatibility — `undefined` is treated as **on**
	 * (only an explicit `false` disables it), matching the plugin default.
	 */
	distributeSnap?: boolean;
	viewportOnly: boolean;
	guideStyle: GuideStyle;
	/** Alt(Option) キーの挙動（既定 `"suppress"`）。 */
	altBehavior: AltBehavior;
	/**
	 * スナップ計算から完全に除外する述語。`true` を返すシェイプは
	 * (a) 吸着先候補にならず、(b) それ自身が動いても吸着されない。
	 * 例: container プラグインが「移動中の親コンテナに追従中の子」を除外する。
	 * `snap:configure` 経由で設定し、`undefined` を渡せば解除。
	 */
	excludeTargets?: (shape: ShapeData) => boolean;
}
