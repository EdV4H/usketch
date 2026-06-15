import type { ShapeData } from "@edv4h/usketch-shared";
import { type CardTypeDefinition, readDeckMeta } from "./types.js";

/** 山札の厚みを表現する後背レイヤーの最大枚数。 */
const MAX_STACK_LAYERS = 4;
const LAYER_OFFSET = 3;

/**
 * card-deck shape の render を生成する。card-type を引いて山札の見た目（積み重ね +
 * 一番上のカード + 残枚数バッジ）を描画する。
 */
export function createDeckRenderer(registry: Map<string, CardTypeDefinition>) {
	return function renderDeck(shape: ShapeData) {
		const meta = readDeckMeta(shape);
		const def = meta.cardType ? registry.get(meta.cardType) : undefined;
		const cards = meta.cards ?? [];
		const count = cards.length;
		const opacity = shape.style?.opacity ?? 1;

		const layers = Math.min(MAX_STACK_LAYERS, Math.max(0, count - 1));

		const topFace = (() => {
			if (!def || count === 0) return null;
			const top = cards[0] as Record<string, unknown>;
			return meta.faceDown ? def.renderBack(top) : def.renderFront(top);
		})();

		return (
			<div
				style={{
					position: "relative",
					width: "100%",
					height: "100%",
					opacity,
					pointerEvents: "none",
					userSelect: "none",
				}}
			>
				{/* 厚み表現: 後ろにずらした空レイヤー */}
				{Array.from({ length: layers }, (_, i) => {
					const d = (layers - i) * LAYER_OFFSET;
					return (
						<div
							key={`layer-${shape.id}-${i}`}
							style={{
								position: "absolute",
								left: d,
								top: d,
								right: -d,
								bottom: -d,
								borderRadius: 10,
								background: "#fff",
								border: "1px solid rgba(0,0,0,0.15)",
								boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
							}}
						/>
					);
				})}

				{/* 一番上のカード or 空表示 */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: 10,
						overflow: "hidden",
						background: "#fff",
						boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
						border: count === 0 ? "2px dashed #bbb" : "1px solid rgba(0,0,0,0.2)",
					}}
				>
					{count === 0 ? (
						<div
							style={{
								width: "100%",
								height: "100%",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: "#999",
								fontSize: 12,
								fontFamily: "system-ui, sans-serif",
							}}
						>
							空
						</div>
					) : (
						topFace
					)}
				</div>

				{/* 残枚数バッジ */}
				{count > 0 && (
					<div
						style={{
							position: "absolute",
							right: -6,
							top: -6,
							minWidth: 22,
							height: 22,
							padding: "0 6px",
							borderRadius: 11,
							background: "#1e1e1e",
							color: "#fff",
							fontSize: 12,
							fontWeight: 700,
							fontFamily: "system-ui, sans-serif",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
						}}
					>
						{count}
					</div>
				)}
			</div>
		);
	};
}
