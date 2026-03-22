import type { AiSmartActionRequestEvent } from "@edv4h/usketch-plugin-ai-agent";
import type { PluginContext, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
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

				const freedrawShapes: ShapeData[] = [];
				const imageShapes: ShapeData[] = [];

				for (const id of selection) {
					const shape = ctx.store.getShape(id);
					if (!shape) continue;
					if (shape.type === "freedraw") freedrawShapes.push(shape);
					else if (shape.type === "image") imageShapes.push(shape);
				}

				if (freedrawShapes.length === 0 && imageShapes.length === 0) return;

				// freedrawの認識
				if (freedrawShapes.length > 0 && imageShapes.length === 0) {
					recognizeFreedraw(ctx, freedrawShapes);
					return;
				}

				// imageの認識
				if (imageShapes.length > 0 && freedrawShapes.length === 0) {
					recognizeImage(ctx, imageShapes);
					return;
				}

				// 混在: freedrawとimageを別々に処理（freedraw優先）
				recognizeFreedraw(ctx, freedrawShapes);
			});

			function recognizeFreedraw(ctx: PluginContext, shapes: ShapeData[]): void {
				const strokeData = serializeFreedrawForRecognition(shapes);
				const shapeIds = shapes.map((s) => s.id);

				const prompt = `Recognize the following handwritten strokes. If they look like text, create text shapes with the recognized text. If they look like geometric shapes (rectangles, circles, arrows), create clean geometric shapes.

Stroke data: ${strokeData}

IMPORTANT:
- Place new shapes at the SAME positions as the original strokes (use the bounds info)
- Use place_shapes to create the new recognized shapes
- Do NOT use modify_shapes on the freedraw shapes`;

				ctx.events.emit<AiSmartActionRequestEvent>("ai:smart-action", {
					action: "custom",
					selectedShapeIds: shapeIds,
					boardId: options.boardId,
					customPrompt: prompt,
				});

				// 完了時に元シェイプを削除
				const unsubResponse = ctx.events.on("ai:response", () => {
					deleteOriginalShapes(ctx, shapeIds);
					unsubResponse();
				});
			}

			function recognizeImage(ctx: PluginContext, shapes: ShapeData[]): void {
				const shapeIds = shapes.map((s) => s.id);

				// 最初のimageのsrcを使用（複数選択時は1枚目のみ）
				const src = shapes[0].src as string | undefined;
				if (!src) return;

				// Vision API経由でimage → shapesに変換
				ctx.events.emit("ai:request", {
					prompt:
						"Analyze this image and recreate its structure as editable shapes on the canvas. Create rectangles, ellipses, and text shapes that match the layout. Place shapes at the same position as the original image.",
					boardId: options.boardId,
					image: src,
				});

				// 完了時に元imageシェイプを削除
				const unsubResponse = ctx.events.on("ai:response", () => {
					deleteOriginalShapes(ctx, shapeIds);
					unsubResponse();
				});
			}

			function deleteOriginalShapes(ctx: PluginContext, ids: string[]): void {
				for (const id of ids) {
					const shape = ctx.store.getShape(id);
					if (shape) {
						const snapshot = { ...shape };
						ctx.commands.execute({
							execute: () => ctx.store.deleteShape(id),
							undo: () => ctx.store.addShape(snapshot),
						});
					}
				}
			}

			cleanup = () => {
				unsubRecognize();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
