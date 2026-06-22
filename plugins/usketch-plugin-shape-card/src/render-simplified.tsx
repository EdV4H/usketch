import type { ShapeData } from "@edv4h/usketch-shared";
import { safeRotation } from "@edv4h/usketch-shared";
import type { CSSProperties, ReactElement } from "react";
import { type CardTypeDefinition, readCardMeta, readDeckMeta } from "./types.js";

/**
 * LOD（低ズーム）時の簡易表示は `dom-renderer` 側でラップされず、world 座標へ
 * self-position する必要がある（`LodFallback` と同じ規約）。card-type 側は枠内の
 * 中身だけを返せばよいよう、この枠付けを plugin に閉じ込める。
 */
function frameStyle(shape: ShapeData): CSSProperties {
	const rotation = safeRotation(shape.rotation);
	return {
		position: "absolute",
		left: shape.x,
		top: shape.y,
		width: shape.width,
		height: shape.height,
		borderRadius: 10,
		overflow: "hidden",
		pointerEvents: "none",
		transform: rotation ? `rotate(${rotation}deg)` : undefined,
		transformOrigin: "center center",
	};
}

/** renderSimplified が無い card-type 用の既定簡易表示（LodFallback 相当のグレー矩形）。 */
function fallbackFill(shape: ShapeData): CSSProperties {
	const fill = (shape.style as { fill?: string } | undefined)?.fill;
	return { ...frameStyle(shape), backgroundColor: fill || "#cccccc" };
}

/**
 * `card` shape の `simplifiedComponent` を生成する。card-type の `renderSimplified`
 * があればカード枠に配置し、無ければグレー矩形にフォールバックする。
 */
export function createCardSimplified(registry: Map<string, CardTypeDefinition>) {
	return function CardSimplified({ shape }: { shape: ShapeData }): ReactElement {
		const meta = readCardMeta(shape);
		const def = meta.cardType ? registry.get(meta.cardType) : undefined;
		const inner = def?.renderSimplified?.(meta.fields ?? def.createDefaultFields());
		if (!inner) return <div style={fallbackFill(shape)} />;
		return <div style={frameStyle(shape)}>{inner}</div>;
	};
}

/**
 * `card-deck` shape の `simplifiedComponent` を生成する。一番上のカード（`cards[0]`）の
 * fields で card-type の `renderSimplified` を呼ぶ。空デッキや renderSimplified 未定義時は
 * グレー矩形にフォールバックする。
 */
export function createDeckSimplified(registry: Map<string, CardTypeDefinition>) {
	return function DeckSimplified({ shape }: { shape: ShapeData }): ReactElement {
		const meta = readDeckMeta(shape);
		const def = meta.cardType ? registry.get(meta.cardType) : undefined;
		const top = meta.cards?.[0];
		const inner = top ? def?.renderSimplified?.(top) : undefined;
		if (!inner) return <div style={fallbackFill(shape)} />;
		return <div style={frameStyle(shape)}>{inner}</div>;
	};
}
