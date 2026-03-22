import type { LayerRenderContext, TransientObject } from "@edv4h/usketch-shared";

import type { CopilotSuggestion } from "./types.js";

export function GhostShape({
	obj,
	ctx,
	onAccept,
}: {
	obj: TransientObject;
	ctx: LayerRenderContext;
	onAccept: (suggestion: CopilotSuggestion) => void;
}) {
	const suggestion = obj.data.suggestion as CopilotSuggestion;
	const vp = ctx.viewport;

	// World to screen conversion
	const screenX = suggestion.x * vp.zoom + vp.x;
	const screenY = suggestion.y * vp.zoom + vp.y;
	const screenW = suggestion.width * vp.zoom;
	const screenH = suggestion.height * vp.zoom;

	const fill = suggestion.style?.fill ?? "#e3f2fd";
	const stroke = suggestion.style?.stroke ?? "#90caf9";

	return (
		<button
			type="button"
			style={{
				position: "absolute",
				left: screenX,
				top: screenY,
				width: screenW,
				height: screenH,
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
					fontSize: Math.max(10, 13 * vp.zoom),
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
