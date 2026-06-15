import type { CardTypeDefinition } from "../types.js";

export type Suit = "♠" | "♥" | "♦" | "♣";

/** トランプ固有データ。 */
export type PlayingCardFields = {
	suit: Suit;
	rank: string; // "A", "2".."10", "J", "Q", "K"
};

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function isRed(suit: Suit): boolean {
	return suit === "♥" || suit === "♦";
}

function PlayingCardIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<title>Playing card</title>
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
			<text x="8" y="10" fontSize="7" textAnchor="middle" fill="currentColor">
				A
			</text>
		</svg>
	);
}

// ピップ配置（数字カード）。x は列(0=左,0.5=中,1=右)、y は上からの割合。
// これらは本物のトランプの並びに準拠し、数に応じて記号の数が変わる。
const PIP_LAYOUTS: Record<string, { x: number; y: number }[]> = {
	"2": [
		{ x: 0.5, y: 0.12 },
		{ x: 0.5, y: 0.88 },
	],
	"3": [
		{ x: 0.5, y: 0.12 },
		{ x: 0.5, y: 0.5 },
		{ x: 0.5, y: 0.88 },
	],
	"4": [
		{ x: 0, y: 0.12 },
		{ x: 1, y: 0.12 },
		{ x: 0, y: 0.88 },
		{ x: 1, y: 0.88 },
	],
	"5": [
		{ x: 0, y: 0.12 },
		{ x: 1, y: 0.12 },
		{ x: 0.5, y: 0.5 },
		{ x: 0, y: 0.88 },
		{ x: 1, y: 0.88 },
	],
	"6": [
		{ x: 0, y: 0.12 },
		{ x: 1, y: 0.12 },
		{ x: 0, y: 0.5 },
		{ x: 1, y: 0.5 },
		{ x: 0, y: 0.88 },
		{ x: 1, y: 0.88 },
	],
	"7": [
		{ x: 0, y: 0.12 },
		{ x: 1, y: 0.12 },
		{ x: 0.5, y: 0.31 },
		{ x: 0, y: 0.5 },
		{ x: 1, y: 0.5 },
		{ x: 0, y: 0.88 },
		{ x: 1, y: 0.88 },
	],
	"8": [
		{ x: 0, y: 0.12 },
		{ x: 1, y: 0.12 },
		{ x: 0.5, y: 0.31 },
		{ x: 0, y: 0.5 },
		{ x: 1, y: 0.5 },
		{ x: 0.5, y: 0.69 },
		{ x: 0, y: 0.88 },
		{ x: 1, y: 0.88 },
	],
	"9": [
		{ x: 0, y: 0.12 },
		{ x: 1, y: 0.12 },
		{ x: 0, y: 0.37 },
		{ x: 1, y: 0.37 },
		{ x: 0.5, y: 0.5 },
		{ x: 0, y: 0.63 },
		{ x: 1, y: 0.63 },
		{ x: 0, y: 0.88 },
		{ x: 1, y: 0.88 },
	],
	"10": [
		{ x: 0, y: 0.12 },
		{ x: 1, y: 0.12 },
		{ x: 0.5, y: 0.25 },
		{ x: 0, y: 0.37 },
		{ x: 1, y: 0.37 },
		{ x: 0, y: 0.63 },
		{ x: 1, y: 0.63 },
		{ x: 0.5, y: 0.75 },
		{ x: 0, y: 0.88 },
		{ x: 1, y: 0.88 },
	],
};

function Corner({ fields, flip }: { fields: PlayingCardFields; flip?: boolean }) {
	return (
		<div
			style={{
				position: "absolute",
				...(flip
					? { right: "6%", bottom: "5%", transform: "rotate(180deg)" }
					: { left: "6%", top: "5%" }),
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				lineHeight: 1,
				fontWeight: 700,
			}}
		>
			<span style={{ fontSize: "11cqh" }}>{fields.rank}</span>
			<span style={{ fontSize: "9cqh" }}>{fields.suit}</span>
		</div>
	);
}

/** 数字カードのピップ群を、配置レイアウトに従って描画する。下半分の記号は 180° 回転。 */
function Pips({ fields }: { fields: PlayingCardFields }) {
	const layout = PIP_LAYOUTS[fields.rank];
	if (!layout) return null;
	return (
		<div style={{ position: "absolute", inset: "14% 26%" }}>
			{layout.map((p, i) => (
				<span
					key={`pip-${i}-${p.x}-${p.y}`}
					style={{
						position: "absolute",
						left: `${p.x * 100}%`,
						top: `${p.y * 100}%`,
						transform: `translate(-50%, -50%)${p.y > 0.5 ? " rotate(180deg)" : ""}`,
						fontSize: "16cqh",
						lineHeight: 1,
					}}
				>
					{fields.suit}
				</span>
			))}
		</div>
	);
}

/** A は中央に大きな1つ、J/Q/K は文字＋スートで表現する。 */
function CenterFigure({ fields }: { fields: PlayingCardFields }) {
	const isAce = fields.rank === "A";
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				lineHeight: 1,
			}}
		>
			<span style={{ fontSize: isAce ? "44cqh" : "34cqh", fontWeight: 700 }}>
				{isAce ? fields.suit : fields.rank}
			</span>
			{!isAce && <span style={{ fontSize: "22cqh" }}>{fields.suit}</span>}
		</div>
	);
}

function renderFront(fields: PlayingCardFields) {
	const color = isRed(fields.suit) ? "#d4233b" : "#1e1e1e";
	const hasPips = fields.rank in PIP_LAYOUTS;
	return (
		<div
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				background: "#fff",
				color,
				fontFamily: "Georgia, 'Times New Roman', serif",
				boxSizing: "border-box",
				containerType: "size",
			}}
		>
			<Corner fields={fields} />
			{hasPips ? <Pips fields={fields} /> : <CenterFigure fields={fields} />}
			<Corner fields={fields} flip />
		</div>
	);
}

function renderBack(_fields: PlayingCardFields) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#b21f2d",
				boxSizing: "border-box",
				padding: 8,
			}}
		>
			<div
				style={{
					width: "100%",
					height: "100%",
					borderRadius: 6,
					border: "2px solid rgba(255,255,255,0.7)",
					backgroundImage:
						"repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 6px, transparent 6px 12px)",
				}}
			/>
		</div>
	);
}

export const playingCardType: CardTypeDefinition<PlayingCardFields> = {
	id: "playing-card",
	label: "トランプ",
	icon: PlayingCardIcon,
	defaultSize: { width: 120, height: 168 },
	aspectRatio: 120 / 168,
	createDefaultFields: () => ({ suit: "♠", rank: "A" }),
	renderFront,
	renderBack,
	placementAnimation: { preset: "slam-medium" },
	buildDeck: () => {
		const deck: PlayingCardFields[] = [];
		for (const suit of SUITS) {
			for (const rank of RANKS) {
				deck.push({ suit, rank });
			}
		}
		return deck;
	},
};
