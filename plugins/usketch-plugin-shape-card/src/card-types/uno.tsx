import type { CardTypeDefinition } from "../types.js";

export type UnoColor = "red" | "yellow" | "green" | "blue" | "wild";

/** UNO 固有データ。 */
export type UnoCardFields = {
	color: UnoColor;
	value: string; // "0".."9", "skip", "reverse", "+2", "wild", "+4"
};

const COLOR_HEX: Record<UnoColor, string> = {
	red: "#d4233b",
	yellow: "#f6c700",
	green: "#1faa4d",
	blue: "#1769d6",
	wild: "#1e1e1e",
};

const NUMBER_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const ACTIONS = ["skip", "reverse", "+2"];

function UnoIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<title>UNO card</title>
			<rect x="3" y="2" width="10" height="12" rx="2" fill="#d4233b" />
			<ellipse cx="8" cy="8" rx="3.5" ry="5" fill="#fff" transform="rotate(20 8 8)" />
			<text x="8" y="10" fontSize="4" textAnchor="middle" fill="#d4233b" fontWeight="bold">
				UNO
			</text>
		</svg>
	);
}

function valueLabel(value: string): string {
	if (value === "skip") return "⦸";
	if (value === "reverse") return "⇄";
	return value.toUpperCase();
}

function renderFront(fields: UnoCardFields) {
	const bg = COLOR_HEX[fields.color];
	const label = valueLabel(fields.value);
	return (
		<div
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				background: bg,
				boxSizing: "border-box",
				padding: 8,
				fontFamily: "system-ui, sans-serif",
				color: "#fff",
				fontWeight: 800,
			}}
		>
			<span style={{ position: "absolute", left: 8, top: 4, fontSize: 16 }}>{label}</span>
			<div
				style={{
					position: "absolute",
					inset: 8,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						width: "70%",
						height: "60%",
						background: "#fff",
						borderRadius: "50%",
						transform: "rotate(-20deg)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: bg,
						fontSize: 30,
					}}
				>
					{label}
				</div>
			</div>
			<span
				style={{
					position: "absolute",
					right: 8,
					bottom: 4,
					fontSize: 16,
					transform: "rotate(180deg)",
				}}
			>
				{label}
			</span>
		</div>
	);
}

function renderBack(_fields: UnoCardFields) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#1e1e1e",
				boxSizing: "border-box",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div
				style={{
					width: "70%",
					height: "60%",
					background: "#d4233b",
					borderRadius: "50%",
					transform: "rotate(-20deg)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#fff",
					fontWeight: 800,
					fontSize: 22,
					fontStyle: "italic",
				}}
			>
				UNO
			</div>
		</div>
	);
}

export const unoCardType: CardTypeDefinition<UnoCardFields> = {
	id: "uno",
	label: "UNO",
	icon: UnoIcon,
	defaultSize: { width: 110, height: 165 },
	aspectRatio: 110 / 165,
	createDefaultFields: () => ({ color: "red", value: "0" }),
	renderFront,
	renderBack,
	placementAnimation: { preset: "slam-heavy" },
	buildDeck: () => {
		const deck: UnoCardFields[] = [];
		for (const color of NUMBER_COLORS) {
			deck.push({ color, value: "0" }); // 0 は各色1枚
			for (let n = 1; n <= 9; n++) {
				deck.push({ color, value: String(n) });
				deck.push({ color, value: String(n) }); // 1..9 は各色2枚
			}
			for (const action of ACTIONS) {
				deck.push({ color, value: action });
				deck.push({ color, value: action }); // アクションは各色2枚
			}
		}
		for (let i = 0; i < 4; i++) {
			deck.push({ color: "wild", value: "wild" });
			deck.push({ color: "wild", value: "+4" });
		}
		return deck;
	},
};
