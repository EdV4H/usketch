import type { AiSmartActionRequestEvent } from "@edv4h/usketch-plugin-ai-agent";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { serializeFreedrawForRecognition } from "./freedraw-serializer.js";

export interface RecognizeOptions {
	boardId: string;
}

export function createAiRecognizePlugin(options: RecognizeOptions): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-ai-recognize",
		name: "AI Recognize",

		setup(ctx: PluginContext) {
			// Listen for recognize requests
			const unsubRecognize = ctx.events.on("ai:recognize", () => {
				const selection = ctx.store.getSelection();
				if (selection.size === 0) return;

				// Get selected freedraw shapes
				const selectedShapes = [];
				for (const id of selection) {
					const shape = ctx.store.getShape(id);
					if (shape && shape.type === "freedraw") {
						selectedShapes.push(shape);
					}
				}

				if (selectedShapes.length === 0) return;

				// Serialize points
				const strokeData = serializeFreedrawForRecognition(selectedShapes);
				const freedrawIds = selectedShapes.map((s) => s.id);

				// Build custom prompt with stroke data
				const prompt = `Recognize the following handwritten strokes. If they look like text, create text shapes with the recognized text. If they look like geometric shapes (rectangles, circles, arrows), create clean geometric shapes.

Stroke data: ${strokeData}

IMPORTANT:
- Place new shapes at the SAME positions as the original strokes (use the bounds info)
- Use place_shapes to create the new recognized shapes
- Do NOT use modify_shapes on the freedraw shapes`;

				// Emit as custom smart action
				ctx.events.emit<AiSmartActionRequestEvent>("ai:smart-action", {
					action: "custom",
					selectedShapeIds: freedrawIds,
					boardId: options.boardId,
					customPrompt: prompt,
				});

				// Listen for ai:response to delete original freedraw shapes
				const unsubResponse = ctx.events.on("ai:response", () => {
					// Delete original freedraw shapes via commands (for undo support)
					for (const id of freedrawIds) {
						const shape = ctx.store.getShape(id);
						if (shape) {
							const snapshot = { ...shape };
							ctx.commands.execute({
								execute: () => ctx.store.deleteShape(id),
								undo: () => ctx.store.addShape(snapshot),
							});
						}
					}
					// Unsubscribe after handling
					unsubResponse();
				});
			});

			cleanup = () => {
				unsubRecognize();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
