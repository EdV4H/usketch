import { motion } from "framer-motion";
import type React from "react";
import { useEffect, useState } from "react";
import type { FadingPinEffect } from "../effect-types";
import type { EffectComponentProps, EffectPlugin } from "../types";

export interface FadingPinEffectConfig {
	color?: string;
	size?: number;
	message?: string;
	authorId?: string;
	label?: string;
	fadeDelay?: number; // Delay before starting to fade (ms)
	fadeDuration?: number; // Total duration including delay (ms)
}

const FadingPinComponent: React.FC<EffectComponentProps<FadingPinEffect>> = ({
	effect,
	camera,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [opacity, setOpacity] = useState(1);

	// Only apply zoom to the size, position is handled by EffectLayer
	const size = (effect.size || 24) * camera.zoom;

	// Calculate fade timing
	const fadeDelay = effect.metadata?.["fadeDelay"] || 3000; // 3 seconds before fading
	const fadeDuration = effect.duration || 5000; // Total 5 seconds lifetime
	const fadeTime = fadeDuration - fadeDelay; // Time to fade out

	useEffect(() => {
		// Start fading after delay
		const timer = setTimeout(() => {
			setOpacity(0);
		}, fadeDelay);

		return () => clearTimeout(timer);
	}, [fadeDelay]);

	return (
		<motion.div
			initial={{ opacity: 1, scale: 0.5 }}
			animate={{
				opacity: opacity,
				scale: 1,
			}}
			transition={{
				opacity: { duration: fadeTime / 1000, ease: "easeOut" },
				scale: { duration: 0.3, ease: "backOut" },
			}}
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				transform: "translate(-50%, -100%)",
			}}
		>
			<motion.button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				whileHover={{ scale: 1.1 }}
				whileTap={{ scale: 0.95 }}
				style={{
					width: size,
					height: size,
					borderRadius: "50%",
					backgroundColor: effect.color,
					border: `2px solid white`,
					boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: size * 0.5,
					color: "white",
					padding: 0,
					position: "relative",
				}}
				aria-label={effect.label || "Fading Pin"}
			>
				{effect.label?.[0] || "📍"}

				{/* Pulse animation ring */}
				<motion.div
					animate={{
						scale: [1, 1.5, 1.5],
						opacity: [0.5, 0, 0],
					}}
					transition={{
						duration: 2,
						repeat: Number.POSITIVE_INFINITY,
						ease: "easeOut",
					}}
					style={{
						position: "absolute",
						inset: -2,
						borderRadius: "50%",
						border: `2px solid ${effect.color}`,
						pointerEvents: "none",
					}}
				/>
			</motion.button>

			{isOpen && effect.message && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.2 }}
					style={{
						position: "absolute",
						top: size + 8,
						left: "50%",
						transform: "translateX(-50%)",
						backgroundColor: "white",
						border: "1px solid #e0e0e0",
						borderRadius: 8,
						padding: 12,
						minWidth: 150,
						maxWidth: 300,
						boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
						zIndex: 1000,
					}}
				>
					<div style={{ fontSize: 14, color: "#333", fontWeight: 500 }}>{effect.message}</div>
					{effect.authorId && (
						<div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>By: {effect.authorId}</div>
					)}
					<div style={{ fontSize: 11, color: "#999", marginTop: 8, fontStyle: "italic" }}>
						Disappearing soon...
					</div>
				</motion.div>
			)}
		</motion.div>
	);
};

export const fadingPinPlugin: EffectPlugin<FadingPinEffect> = {
	type: "fading-pin",
	name: "Fading Comment Pin",
	component: FadingPinComponent,

	createDefaultEffect: ({ id, x, y, ...config }) => {
		const fadeConfig = config as FadingPinEffectConfig;
		return {
			id,
			type: "fading-pin",
			x,
			y,
			color: fadeConfig.color || "#9b59b6", // Purple default for fading pins
			size: fadeConfig.size || 24,
			message: fadeConfig.message || "Temporary note",
			authorId: fadeConfig.authorId || "",
			label: fadeConfig.label || "📍",
			createdAt: Date.now(),
			duration: fadeConfig.fadeDuration || 5000, // Will be auto-removed after this duration
			metadata: {
				fadeDelay: fadeConfig.fadeDelay || 3000,
			},
		};
	},

	validate: (effect) => {
		return effect.type === "fading-pin" && typeof effect["color"] === "string";
	},

	interactive: true,

	hitTest: (effect, point) => {
		const dx = point.x - effect.x;
		const dy = point.y - effect.y;
		const radius = (effect.size || 24) / 2;
		return Math.sqrt(dx * dx + dy * dy) <= radius;
	},
};
