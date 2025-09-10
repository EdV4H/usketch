import { useEffectRegistry } from "@usketch/effect-registry";
import type { Effect } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { AnimatePresence, motion } from "framer-motion";
import { type FC, memo, useCallback, useEffect } from "react";

interface EffectLayerProps {
	className?: string;
}

export const EffectLayer: FC<EffectLayerProps> = memo(({ className }) => {
	const effectsMap = useWhiteboardStore((state) => state.effects);
	const camera = useWhiteboardStore((state) => state.camera);
	const clearExpiredEffects = useWhiteboardStore((state) => state.clearExpiredEffects);
	const registry = useEffectRegistry();

	// Convert effects object to array for rendering
	const effects = Object.values(effectsMap);

	// Clean up expired effects periodically
	useEffect(() => {
		const interval = setInterval(() => {
			clearExpiredEffects();
		}, 1000); // Check every second

		return () => clearInterval(interval);
	}, [clearExpiredEffects]);

	const renderEffect = useCallback(
		(effect: Effect) => {
			const plugin = registry.getPlugin(effect.type);
			if (!plugin) {
				console.warn(`No plugin found for effect type: ${effect.type}`);
				return null;
			}

			const Component = plugin.component;
			const key = `${effect.type}-${effect.id}`;

			// Apply animation if the plugin has animation config
			if (plugin.animation) {
				return (
					<motion.div
						key={key}
						initial={plugin.animation.initial}
						animate={plugin.animation.animate}
						exit={plugin.animation.exit}
						transition={plugin.animation.transition}
						style={{
							position: "absolute",
							left: effect.x,
							top: effect.y,
							zIndex: effect.zIndex || 1000,
							pointerEvents: plugin.interactive ? "auto" : "none",
						}}
					>
						<Component effect={effect} camera={camera} />
					</motion.div>
				);
			}

			// No animation, render directly
			return (
				<div
					key={key}
					style={{
						position: "absolute",
						left: effect.x,
						top: effect.y,
						zIndex: effect.zIndex || 1000,
						pointerEvents: plugin.interactive ? "auto" : "none",
					}}
				>
					<Component effect={effect} camera={camera} />
				</div>
			);
		},
		[registry, camera],
	);

	return (
		<div
			className={className}
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				overflow: "hidden",
			}}
			data-testid="effect-layer"
		>
			<AnimatePresence mode="popLayout">{effects.map(renderEffect)}</AnimatePresence>
		</div>
	);
});

EffectLayer.displayName = "EffectLayer";
