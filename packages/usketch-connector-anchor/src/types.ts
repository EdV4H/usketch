import type { Point, ShapeData } from "@edv4h/usketch-shared";
import type { AnchorType } from "./anchor-utils.js";
import type { PathType } from "./path-utils.js";

/** Arrow head style for a connector. */
export type ArrowHead = "none" | "forward" | "backward" | "both";

/**
 * Common shape fields used by any connector implementation.
 * Concrete connectors (e.g. base `connector`, `domain-connector`) extend this
 * with their own `type` literal and `meta` payload.
 */
export interface ConnectableShapeData extends ShapeData {
	sourceId?: string;
	targetId?: string;
	sourceAnchor?: AnchorType;
	targetAnchor?: AnchorType;
	sourcePoint?: Point;
	targetPoint?: Point;
	/**
	 * `sourceAnchor === "custom"` の端点を、接続先 shape 内の相対位置として保持する。
	 * shape ローカル（回転前）座標で x/y を width/height に対する比率（0〜1）で表す。
	 * tracker はこれから `sourcePoint` を毎回計算し直すため、移動の処理順に依存しない。
	 * 未設定（旧データ）の場合は従来どおり shape の移動量を `sourcePoint` に足す。
	 */
	sourceAnchorRatio?: Point;
	/** `targetAnchor === "custom"` 用。{@link sourceAnchorRatio} と同じ。 */
	targetAnchorRatio?: Point;
	controlPoint?: Point;
	controlPointAuto?: boolean;
	arrowHead?: ArrowHead;
	pathType?: PathType;
	label?: string;
}

export type { AnchorType, PathType };
