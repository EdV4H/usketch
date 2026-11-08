import type { ShapeData } from "@edv4h/usketch-shared";
import { type ReactElement, useEffect, useState } from "react";
import { type CardTypeDefinition, type DeckShuffleAnimation, readDeckMeta } from "./types.js";

/** 山札の厚みを表現する後背レイヤーの最大枚数。 */
const MAX_STACK_LAYERS = 4;
const LAYER_OFFSET = 3;

/**
 * card-type 個別 → プラグイン既定の順でシャッフル演出を解決し、`shuffledAt` から数えて
 * まだ再生中なら終わる時刻（epoch ms）を返す。演出が無い / 再生し終えていれば null。
 */
export function resolveShuffleEnd(
	shape: ShapeData,
	def: CardTypeDefinition | undefined,
	pluginDefault: DeckShuffleAnimation | undefined,
	now: number,
): { animation: DeckShuffleAnimation; startAt: number; durationMs: number } | null {
	const animation = def?.shuffleAnimation ?? pluginDefault;
	const meta = readDeckMeta(shape);
	const startAt = meta.shuffledAt;
	if (!animation || typeof startAt !== "number" || !Number.isFinite(startAt)) return null;
	const count = (meta.cards ?? []).length;
	if (count < 2) return null;
	const raw =
		typeof animation.durationMs === "function" ? animation.durationMs(count) : animation.durationMs;
	const durationMs = Number.isFinite(raw) ? Math.max(0, raw) : 0;
	if (durationMs === 0 || now >= startAt + durationMs) return null;
	return { animation, startAt, durationMs };
}

/**
 * 再生中は `playing`、`until` を過ぎたら `idle` を描く。shape が再描画されなくても
 * 自前のタイマーで静止表示へ戻る（シャッフルごとに key を変えて作り直す）。
 */
function ShuffleGate({
	until,
	playing,
	idle,
}: {
	until: number;
	playing: ReactElement;
	idle: ReactElement;
}) {
	const [done, setDone] = useState(() => Date.now() >= until);
	useEffect(() => {
		const rest = until - Date.now();
		if (rest <= 0) {
			setDone(true);
			return;
		}
		const timer = setTimeout(() => setDone(true), rest);
		return () => clearTimeout(timer);
	}, [until]);
	return done ? idle : playing;
}

/**
 * card-deck shape の render を生成する。card-type を引いて山札の見た目（積み重ね +
 * 一番上のカード + 残枚数バッジ）を描画する。シャッフル演出（`shuffleAnimation`）が
 * あれば、`shuffledAt` から再生時間の間だけ host の描画に差し替える。
 */
export function createDeckRenderer(
	registry: Map<string, CardTypeDefinition>,
	shuffleAnimation?: DeckShuffleAnimation,
) {
	return function renderDeck(shape: ShapeData) {
		const meta = readDeckMeta(shape);
		const def = meta.cardType ? registry.get(meta.cardType) : undefined;
		const idle = renderDeckStatic(shape, def);
		const shuffle = resolveShuffleEnd(shape, def, shuffleAnimation, Date.now());
		if (!shuffle) return idle;
		const cards = meta.cards ?? [];
		const playing = shuffle.animation.render({
			shape,
			count: cards.length,
			startAt: shuffle.startAt,
			durationMs: shuffle.durationMs,
			faceDown: meta.faceDown ?? true,
			renderBack: () => (def && cards[0] ? def.renderBack(cards[0]) : null),
		});
		return (
			<ShuffleGate
				key={`shuffle-${shuffle.startAt}`}
				until={shuffle.startAt + shuffle.durationMs}
				playing={playing}
				idle={idle}
			/>
		);
	};
}

function renderDeckStatic(shape: ShapeData, def: CardTypeDefinition | undefined) {
	const meta = readDeckMeta(shape);
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
}
