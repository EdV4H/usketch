import { renderFace } from "../card-face.js";
import type { CardFace, CardTypeDefinition } from "../types.js";

/**
 * カスタムカード固有データ。表/裏それぞれにテクスチャとテキスト配置を自由に持つ。
 * コードを書かずに（meta.fields の差し替えだけで）見た目を完全に制御できる card-type。
 */
export type CustomCardFields = {
	front: CardFace;
	back: CardFace;
};

function CustomIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<title>Custom card</title>
			<rect
				x="3"
				y="2"
				width="10"
				height="12"
				rx="1.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
		</svg>
	);
}

export const customCardType: CardTypeDefinition<CustomCardFields> = {
	id: "custom",
	label: "カスタム",
	icon: CustomIcon,
	defaultSize: { width: 240, height: 320 },
	aspectRatio: 240 / 320,
	createDefaultFields: () => ({
		front: {
			texture: { color: "linear-gradient(135deg, #fdfbfb, #ebedee)" },
			texts: [
				{
					text: "タイトル",
					x: 0.5,
					y: 0.18,
					align: "center",
					vAlign: "middle",
					fontSize: 22,
					fontWeight: 700,
					color: "#1e1e1e",
				},
				{
					text: "本文をここに。\n位置・回転・フォントを\n細かく指定できます。",
					x: 0.5,
					y: 0.55,
					align: "center",
					vAlign: "middle",
					fontSize: 13,
					color: "#444",
					maxWidth: 200,
					lineHeight: 1.5,
				},
			],
		},
		back: {
			texture: { color: "linear-gradient(135deg, #4f8cff, #1e1e1e)" },
			texts: [
				{
					text: "BACK",
					x: 0.5,
					y: 0.5,
					align: "center",
					vAlign: "middle",
					fontSize: 28,
					fontWeight: 800,
					color: "#ffffff",
					letterSpacing: 4,
				},
			],
		},
	}),
	renderFront: (fields) => renderFace(fields.front),
	renderBack: (fields) => renderFace(fields.back),
	placementAnimation: { preset: "drop" },
};
