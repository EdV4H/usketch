import type { EffectComponentProps, EffectPlugin } from "@usketch/effect-registry";
import type { RippleEffect } from "@usketch/shared-types";
import { motion } from "framer-motion";
import type React from "react";
import { useEffect, useState } from "react";

export interface RippleEffectConfig {
	radius?: number;
	color?: string;
	duration?: number;
	opacity?: number;
}

const RippleComponent: React.FC<EffectComponentProps<RippleEffect>> = ({
	effect,
	camera,
	onComplete,
}) => {
	const [isAnimating, setIsAnimating] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsAnimating(false);
			onComplete?.();
		}, effect.duration || 500);

		return () => clearTimeout(timer);
	}, [effect.duration, onComplete]);

	// Only apply zoom to the radius, position is handled by EffectLayer
	const radius = effect.radius * camera.zoom;

	if (!isAnimating) return null;

	return (
		<motion.div
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width: radius * 2,
				height: radius * 2,
				borderRadius: "50%",
				border: `4px solid ${effect.color}`, // Thicker border
				backgroundColor: `${effect.color}99`, // Much more opaque fill (60% opacity)
				transform: "translate(-50%, -50%)",
				pointerEvents: "none",
				boxShadow: `0 0 20px ${effect.color}`, // Add glow effect
			}}
			initial={{ scale: 0.3, opacity: 1 }} // Always start at full opacity
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

	animation: {
		initial: { scale: 0, opacity: 1 },
		animate: { scale: 1, opacity: 0 },
		exit: { opacity: 0 },
		transition: {
			duration: 0.5,
			ease: "easeOut",
		},
	},

	interactive: false,
};
