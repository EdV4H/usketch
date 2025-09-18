import type { Effect } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";

// Simple Tool interface for the effect tool
export interface Tool {
	id: string;
	name: string;
	icon: string;
	cursor: string;
	activate?(): void;
	deactivate?(): void;
	onPointerDown(event: PointerEvent): void;
	onPointerMove(event: PointerEvent): void;
	onPointerUp(event: PointerEvent): void;
	onKeyDown?(event: KeyboardEvent): void;
	onKeyUp?(event: KeyboardEvent): void;
}

export interface EffectToolConfig {
	effectType: "ripple" | "pin" | "fading-pin";
	effectConfig?: Record<string, any>;
}

export class EffectTool implements Tool {
	id = "effect";
	name = "Effect Tool";
	icon = "✨";
	cursor = "crosshair";

	private config: EffectToolConfig = {
		effectType: "ripple",
	};

	setConfig(config: Partial<EffectToolConfig>): void {
		this.config = { ...this.config, ...config };
	}

	activate(): void {
		// Effect tool activated
	}

	deactivate(): void {
		// Effect tool deactivated
	}

	onPointerDown(event: PointerEvent): void {
		const target = event.target as HTMLElement;
		const canvasElement = target.closest(".whiteboard-canvas");

		if (!canvasElement) return;

		const rect = canvasElement.getBoundingClientRect();
		const camera = whiteboardStore.getState().camera;

		// Convert screen coordinates to world coordinates
		const x = (event.clientX - rect.left - camera.x) / camera.zoom;
		const y = (event.clientY - rect.top - camera.y) / camera.zoom;

		// Create effect based on type
		let effect: Effect;

		const config = this.config.effectConfig || {};

		switch (this.config.effectType) {
			case "ripple":
				effect = {
					id: `ripple-${Date.now()}`,
					type: "ripple",
					x,
					y,
					radius: config["radius"] || 60,
					color: config["color"] || "#4ECDC4",
					opacity: config["opacity"] || 1.0,
					createdAt: Date.now(),
					duration: config["duration"] || 600,
				};
				break;

			case "pin":
				effect = {
					id: `pin-${Date.now()}`,
					type: "pin",
					x,
					y,
					color: config["color"] || "#ff6b6b",
					size: config["size"] || 24,
					message: config["message"] || "Comment",
					label: config["label"] || "📌",
					createdAt: Date.now(),
				};
				break;

			case "fading-pin":
				effect = {
					id: `fading-pin-${Date.now()}`,
					type: "fading-pin",
					x,
					y,
					color: config["color"] || "#9b59b6",
					size: config["size"] || 24,
					message: config["message"] || "Temporary note",
					label: config["label"] || "📍",
					createdAt: Date.now(),
					duration: config["fadeDuration"] || 5000,
					metadata: {
						fadeDelay: config["fadeDelay"] || 3000,
					},
				};
				break;

			default:
				return;
		}

		whiteboardStore.getState().addEffect(effect);
	}

	onPointerMove(_event: PointerEvent): void {
		// No action on move
	}

	onPointerUp(_event: PointerEvent): void {
		// No action on up
	}

	onKeyDown(_event: KeyboardEvent): void {
		// No keyboard shortcuts for now
	}

	onKeyUp(_event: KeyboardEvent): void {
		// No keyboard shortcuts for now
	}
}

// Export singleton instance
export const effectTool = new EffectTool();
