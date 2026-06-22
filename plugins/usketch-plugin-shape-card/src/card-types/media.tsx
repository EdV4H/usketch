import type { CardTypeDefinition } from "../types.js";

/** メディアカード固有データ（Record<string, unknown> に代入可能にするため type で定義）。 */
export type MediaCardFields = {
	title: string;
	body: string;
	imageUrl?: string;
	backText?: string;
	accentColor?: string;
};

const DEFAULT_ACCENT = "#4f8cff";

function MediaIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<title>Media card</title>
			<rect
				x="2"
				y="2"
				width="12"
				height="12"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<rect x="2" y="2" width="12" height="6" rx="2" fill="currentColor" opacity="0.25" />
			<line x1="4" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="1" />
			<line x1="4" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}

function renderFront(fields: MediaCardFields) {
	const accent = fields.accentColor ?? DEFAULT_ACCENT;
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				fontFamily: "system-ui, sans-serif",
				color: "#1e1e1e",
				boxSizing: "border-box",
			}}
		>
			<div style={{ flex: "0 0 50%", overflow: "hidden", background: accent }}>
				{fields.imageUrl ? (
					// biome-ignore lint/a11y/useAltText: decorative card image inside canvas shape
					<img
						src={fields.imageUrl}
						style={{ width: "100%", height: "100%", objectFit: "cover" }}
					/>
				) : (
					<div
						style={{
							width: "100%",
							height: "100%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "rgba(255,255,255,0.85)",
							fontSize: 28,
						}}
					>
						🖼
					</div>
				)}
			</div>
			<div style={{ flex: "1 1 auto", padding: 12, overflow: "hidden" }}>
				<div
					style={{
						fontWeight: 700,
						fontSize: 16,
						marginBottom: 6,
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{fields.title}
				</div>
				<div
					style={{
						fontSize: 13,
						lineHeight: 1.4,
						color: "#444",
						whiteSpace: "pre-wrap",
						overflow: "hidden",
					}}
				>
					{fields.body}
				</div>
			</div>
		</div>
	);
}

function renderBack(fields: MediaCardFields) {
	const accent = fields.accentColor ?? DEFAULT_ACCENT;
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 16,
				boxSizing: "border-box",
				background: `linear-gradient(135deg, ${accent}, #1e1e1e)`,
				color: "#fff",
				fontFamily: "system-ui, sans-serif",
				fontSize: 13,
				lineHeight: 1.5,
				whiteSpace: "pre-wrap",
				textAlign: "center",
			}}
		>
			{fields.backText ?? "（裏面）"}
		</div>
	);
}

/** 低ズーム表示: アクセント帯 + タイトルだけの軽量表示。 */
function renderSimplified(fields: MediaCardFields) {
	const accent = fields.accentColor ?? DEFAULT_ACCENT;
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				fontFamily: "system-ui, sans-serif",
				background: "#fff",
				containerType: "size",
			}}
		>
			<div style={{ flex: "0 0 45%", background: accent }} />
			<div
				style={{
					flex: "1 1 auto",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "0 8%",
					color: "#1e1e1e",
					fontWeight: 700,
					fontSize: "14cqh",
					textAlign: "center",
					overflow: "hidden",
				}}
			>
				<span
					style={{
						display: "-webkit-box",
						WebkitBoxOrient: "vertical",
						WebkitLineClamp: 2,
						overflow: "hidden",
					}}
				>
					{fields.title}
				</span>
			</div>
		</div>
	);
}

export const mediaCardType: CardTypeDefinition<MediaCardFields> = {
	id: "media",
	label: "メディアカード",
	icon: MediaIcon,
	defaultSize: { width: 240, height: 320 },
	aspectRatio: 240 / 320,
	createDefaultFields: () => ({
		title: "タイトル",
		body: "本文をここに表示します。",
		backText: "メモ・補足を裏面に。",
		accentColor: DEFAULT_ACCENT,
	}),
	renderFront,
	renderBack,
	renderSimplified,
	placementAnimation: { preset: "drop" },
};
