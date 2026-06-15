import type { ShapeData } from "@edv4h/usketch-shared";
import type { CSSProperties } from "react";
import { type CardTypeDefinition, readCardMeta } from "./types.js";

const FLIP_MS = 400;

const faceStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	borderRadius: 10,
	overflow: "hidden",
	boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
	background: "#fff",
	// 3D flip 用: 裏返ったときに背面を隠す
	backfaceVisibility: "hidden",
	WebkitBackfaceVisibility: "hidden",
};

function UnknownCard({ cardType }: { cardType?: string }) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				borderRadius: 10,
				border: "1px dashed #aaa",
				color: "#888",
				fontSize: 12,
				fontFamily: "system-ui, sans-serif",
				background: "#f5f5f5",
				boxSizing: "border-box",
				padding: 8,
				textAlign: "center",
			}}
		>
			unknown card-type:
			<br />
			{cardType ?? "(none)"}
		</div>
	);
}

/**
 * card shape の render を生成する。card-type レジストリを引いて front/back を描画し、
 * `isFlipped` に応じて Y 軸 3D フリップする。
 */
export function createCardRenderer(registry: Map<string, CardTypeDefinition>) {
	return function renderCard(shape: ShapeData) {
		const meta = readCardMeta(shape);
		const def = meta.cardType ? registry.get(meta.cardType) : undefined;
		const opacity = shape.style?.opacity ?? 1;

		if (!def) {
			return (
				<div style={{ width: "100%", height: "100%", opacity, pointerEvents: "none" }}>
					<UnknownCard cardType={meta.cardType} />
				</div>
			);
		}

		const fields = meta.fields ?? def.createDefaultFields();
		const flipped = meta.isFlipped ?? false;

		return (
			<div
				style={{
					width: "100%",
					height: "100%",
					perspective: 1000,
					opacity,
					pointerEvents: "none",
					userSelect: "none",
				}}
			>
				<div
					style={{
						position: "relative",
						width: "100%",
						height: "100%",
						transformStyle: "preserve-3d",
						transition: `transform ${FLIP_MS}ms`,
						transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
					}}
				>
					<div style={faceStyle}>{def.renderFront(fields)}</div>
					<div style={{ ...faceStyle, transform: "rotateY(180deg)" }}>{def.renderBack(fields)}</div>
				</div>
			</div>
		);
	};
}
