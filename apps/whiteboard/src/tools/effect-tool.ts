import type { Effect } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import type { Tool } from "@usketch/tools";

export interface EffectToolConfig {
	effectType: "ripple" | "pin";
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
		console.log("Effect tool activated", this.config);
	}

	deactivate(): void {
		console.log("Effect tool deactivated");
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

		switch (this.config.effectType) {
			case "ripple":
				effect = {
					id: `ripple-${Date.now()}`,
					type: "ripple",
					x,
					y,
					radius: this.config.effectConfig?.radius || 60,
					color: this.config.effectConfig?.color || "#4ECDC4",
					opacity: this.config.effectConfig?.opacity || 1.0,
					createdAt: Date.now(),
					duration: this.config.effectConfig?.duration || 600,
				};
				break;

			case "pin":
				effect = {
					id: `pin-${Date.now()}`,
					type: "pin",
					x,
					y,
					color: this.config.effectConfig?.color || "#ff6b6b",
					size: this.config.effectConfig?.size || 24,
					message: this.config.effectConfig?.message || "Comment",
					label: this.config.effectConfig?.label || "📌",
					createdAt: Date.now(),
				};
				break;

			default:
				return;
		}

		console.log(`Adding ${this.config.effectType} effect at`, { x, y }, effect);
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
