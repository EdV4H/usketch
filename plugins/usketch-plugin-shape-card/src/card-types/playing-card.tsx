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

function Corner({ fields, flip }: { fields: PlayingCardFields; flip?: boolean }) {
	return (
		<div
			style={{
				position: "absolute",
				...(flip ? { right: 6, bottom: 4, transform: "rotate(180deg)" } : { left: 6, top: 4 }),
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				lineHeight: 1,
				fontWeight: 700,
			}}
		>
			<span style={{ fontSize: 14 }}>{fields.rank}</span>
			<span style={{ fontSize: 12 }}>{fields.suit}</span>
		</div>
	);
}

function renderFront(fields: PlayingCardFields) {
	const color = isRed(fields.suit) ? "#d4233b" : "#1e1e1e";
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
			}}
		>
			<Corner fields={fields} />
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 48,
				}}
			>
				{fields.suit}
			</div>
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
	placementAnimation: { preset: "deal" },
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
