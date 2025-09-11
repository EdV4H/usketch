import type { EffectComponentProps, EffectPlugin } from "@usketch/effect-registry";
import type { PinEffect } from "@usketch/shared-types";
import type React from "react";
import { useState } from "react";

export interface PinEffectConfig {
	color?: string;
	size?: number;
	message?: string;
	authorId?: string;
	label?: string;
}

const PinComponent: React.FC<EffectComponentProps<PinEffect>> = ({ effect, camera }) => {
	const [isOpen, setIsOpen] = useState(false);

	// Only apply zoom to the size, position is handled by EffectLayer
	const size = (effect.size || 24) * camera.zoom;

	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				transform: "translate(-50%, -100%)",
			}}
		>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				style={{
					width: size,
					height: size,
					borderRadius: "50%",
					backgroundColor: effect.color,
					border: `2px solid white`,
					boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: size * 0.5,
					color: "white",
					padding: 0,
				}}
				aria-label={effect.label || "Pin"}
			>
				{effect.label?.[0] || "📌"}
			</button>

			{isOpen && effect.message && (
				<div
					style={{
						position: "absolute",
						top: size + 8,
						left: "50%",
						transform: "translateX(-50%)",
						backgroundColor: "white",
						border: "1px solid #e0e0e0",
						borderRadius: 4,
						padding: 8,
						minWidth: 150,
						maxWidth: 300,
						boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
						zIndex: 1000,
					}}
				>
					<div style={{ fontSize: 14, color: "#333" }}>{effect.message}</div>
					{effect.authorId && (
						<div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>By: {effect.authorId}</div>
					)}
				</div>
			)}
		</div>
	);
};

export const pinPlugin: EffectPlugin<PinEffect> = {
	type: "pin",
	name: "Comment Pin",
	component: PinComponent,

	createDefaultEffect: ({ id, x, y, ...config }) => ({
		id,
		type: "pin",
		x,
		y,
		color: (config as PinEffectConfig).color || "#ff6b6b",
		size: (config as PinEffectConfig).size || 24,
		message: (config as PinEffectConfig).message,
		authorId: (config as PinEffectConfig).authorId,
		label: (config as PinEffectConfig).label,
		createdAt: Date.now(),
	}),

	validate: (effect) => {
		return effect.type === "pin" && typeof effect.color === "string";
	},

	interactive: true,

	hitTest: (effect, point) => {
		const dx = point.x - effect.x;
		const dy = point.y - effect.y;
		const radius = (effect.size || 24) / 2;
		return Math.sqrt(dx * dx + dy * dy) <= radius;
	},
};
