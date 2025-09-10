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

	const x = effect.x * camera.zoom + camera.x;
	const y = effect.y * camera.zoom + camera.y;
	const radius = effect.radius * camera.zoom;

	if (!isAnimating) return null;

	return (
		<motion.div
			style={{
				position: "absolute",
				left: x,
				top: y,
				width: radius * 2,
				height: radius * 2,
				borderRadius: "50%",
				backgroundColor: effect.color,
				transform: "translate(-50%, -50%)",
				pointerEvents: "none",
			}}
			initial={{ scale: 0, opacity: effect.opacity }}
			animate={{
				scale: 2,
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
		radius: (config as RippleEffectConfig).radius || 20,
		color: (config as RippleEffectConfig).color || "#007bff",
		opacity: (config as RippleEffectConfig).opacity || 0.5,
		duration: (config as RippleEffectConfig).duration || 500,
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
