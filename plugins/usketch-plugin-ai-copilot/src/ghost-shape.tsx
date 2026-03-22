import type { LayerRenderContext, TransientObject } from "@edv4h/usketch-shared";

import type { CopilotSuggestion } from "./types.js";

export function GhostShape({
	obj,
	onAccept,
}: {
	obj: TransientObject;
	ctx: LayerRenderContext;
	onAccept: (suggestion: CopilotSuggestion) => void;
}) {
	const suggestion = obj.data.suggestion as CopilotSuggestion;

	// ワールド座標をそのまま使用（Canvasのviewport transformが変換する）
	const fill = suggestion.style?.fill ?? "#e3f2fd";
	const stroke = suggestion.style?.stroke ?? "#90caf9";

	const label = suggestion.text
		? `Accept suggestion: ${suggestion.text}`
		: `Accept suggested ${suggestion.type}`;

	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			style={{
				position: "absolute",
				left: suggestion.x,
				top: suggestion.y,
				width: suggestion.width,
				height: suggestion.height,
				pointerEvents: "auto",
				cursor: "pointer",
				padding: 0,
				margin: 0,
				background: "none",
				border: "none",
			}}
			onClick={(e) => {
				e.stopPropagation();
				onAccept(suggestion);
			}}
		>
			{/* Ghost shape body */}
			<div
				style={{
					width: "100%",
					height: "100%",
					border: `2px dashed ${stroke}`,
					borderRadius: suggestion.type === "ellipse" ? "50%" : 4,
					background: fill,
					opacity: 0.4,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 13,
					color: "#666",
					fontFamily: "system-ui, sans-serif",
					overflow: "hidden",
					animation: "ai-ghost-fade-in 0.3s ease-out",
				}}
			>
				{suggestion.text && (
					<span style={{ padding: 4, textAlign: "center", lineHeight: 1.3 }}>
						{suggestion.text}
					</span>
				)}
			</div>
			{/* Accept indicator on hover */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					top: -8,
					right: -8,
					width: 20,
					height: 20,
					borderRadius: "50%",
					background: "#4caf50",
					color: "#fff",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 12,
					fontWeight: "bold",
					boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
					opacity: 0,
					transition: "opacity 0.15s",
				}}
				className="ai-ghost-accept-btn"
			>
				✓
			</div>
		</button>
	);
}
