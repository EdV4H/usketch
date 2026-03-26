import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderProgress(data: ShapeData) {
	const progress = Math.max(0, Math.min(100, (data.progress as number) ?? 60));
	const progressLabel = (data.progressLabel as string) || "";

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				gap: 8,
				fontFamily: WF.font,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					flex: 1,
					height: "100%",
					background: WF.colors.surface,
					borderRadius: WF.radius,
					border: `1px solid ${WF.colors.border}`,
					overflow: "hidden",
					position: "relative",
				}}
			>
				<div
					style={{
						width: `${progress}%`,
						height: "100%",
						background: WF.colors.primary,
						borderRadius: WF.radius,
					}}
				/>
			</div>
			{progressLabel && (
				<div
					style={{
						fontSize: WF.fontSize.sm,
						color: WF.colors.secondary,
						flexShrink: 0,
					}}
				>
					{progressLabel}
				</div>
			)}
		</div>
	);
}

export function createDefaultProgress(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-progress",
		x: params.x,
		y: params.y,
		width: 200,
		height: 24,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		progress: 60,
		progressLabel: "",
	};
}
