import { motion } from "framer-motion";
import type React from "react";
import { useEffect, useState } from "react";
import type { RippleEffect } from "../effect-types";
import type { EffectComponentProps, EffectPlugin } from "../types";

export interface RippleEffectConfig {
	radius?: number;
	color?: string;
	duration?: number;
	opacity?: number;
}

// Constants for visual styling
const RIPPLE_FILL_OPACITY = 0.6; // 60% opacity for fill

const RippleComponent: React.FC<EffectComponentProps<RippleEffect>> = ({
	effect,
	camera,
	onRemove,
}) => {
	const [isAnimating, setIsAnimating] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsAnimating(false);
			onRemove?.();
		}, effect.duration || 500);

		return () => clearTimeout(timer);
	}, [effect.duration, onRemove]);

	// Only apply zoom to the radius, position is handled by EffectLayer
	const radius = effect.radius * camera.zoom;
	const size = radius * 2;

	// Convert color to rgba with opacity
	const fillColor = `${effect.color}${Math.round(RIPPLE_FILL_OPACITY * 255)
		.toString(16)
		.padStart(2, "0")}`;

	if (!isAnimating) return null;

	return (
		<motion.div
			style={{
				position: "absolute",
				left: -size / 2,
				top: -size / 2,
				width: size,
				height: size,
				borderRadius: "50%",
				border: `4px solid ${effect.color}`,
				backgroundColor: fillColor,
				pointerEvents: "none",
				boxShadow: `0 0 20px ${effect.color}`,
			}}
			initial={{ scale: 0.3, opacity: 1 }}
			animate={{
				scale: 2.5,
				opacity: 0,
			}}
			transition={{
				duration: (effect.duration || 500) / 1000,
				ease: "easeOut",
			}}
		/>
	);
};

export const ripplePlugin: EffectPlugin<RippleEffect> = {
	type: "ripple",
	name: "Ripple Effect",
	component: RippleComponent,

	createDefaultEffect: ({ id, x, y, ...config }) => ({
		id,
		type: "ripple",
		x,
		y,
		radius: (config as RippleEffectConfig).radius || 50,
		color: (config as RippleEffectConfig).color || "#007bff",
		opacity: (config as RippleEffectConfig).opacity || 1.0, // Maximum opacity
		duration: (config as RippleEffectConfig).duration || 600,
		createdAt: Date.now(),
	}),

	validate: (effect) => {
		return (
			effect.type === "ripple" &&
			typeof effect.radius === "number" &&
			effect.radius > 0 &&
			typeof effect.color === "string" &&
			typeof effect.opacity === "number" &&
			effect.opacity >= 0 &&
			effect.opacity <= 1
		);
	},

	interactive: false,
};
