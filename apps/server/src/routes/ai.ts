import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { AppDb, Env } from "../types.js";

type AiEnv = {
	Bindings: Env;
	Variables: {
		db: AppDb;
		userId: string;
	};
};

const aiApp = new Hono<AiEnv>();

const completeSchema = z.object({
	prompt: z.string().min(1).max(4000),
	canvasContext: z.string().max(32000),
	boardId: z.string().min(1),
	model: z.string().optional().default("gpt-4o"),
});

const SYSTEM_PROMPT = `You are an AI assistant for uSketch, a collaborative whiteboard.
You create diagrams, flowcharts, wireframes, and visual layouts on a shared canvas.

Use the place_shapes function to add shapes to the canvas.

Coordinate system: x increases rightward, y increases downward.
Standard sizes: 160x80 for boxes, 160x40 for text labels.
Spacing: 40px between shapes, 20px for labels.

Shape type guide:
- "rectangle": A box. Use for containers, cards, flowchart nodes. Set fill for colored backgrounds.
- "ellipse": An oval/circle.
- "text": A text label. ALWAYS set the "text" field with the label content. Use fontSize (default 16) for size. Style: fill should be "transparent", strokeWidth 0, stroke is the text color.
- "freedraw": Freehand drawing (rarely used by AI).

IMPORTANT: To show text on the canvas, you MUST use type "text" with the "text" field.
For labeled boxes, place a "rectangle" shape AND a separate "text" shape on top of it.
Example: a labeled box at (100,100) size 160x80 needs:
  1. rectangle at (100,100) 160x80 with fill color
  2. text at (110,125) 140x30 with the label text, fontSize 16

Layout principles:
- Flowcharts: top-to-bottom or left-to-right
- Place shapes near the viewport center provided in the canvas context
- Use fills for visual distinction (e.g. #e3f2fd for blue, #fff3e0 for orange, #e8f5e9 for green)
- Always add text labels to describe elements using "text" shapes
- Keep layouts clean and well-spaced`;

const PLACE_SHAPES_TOOL = {
	type: "function" as const,
	function: {
		name: "place_shapes",
		description:
			"Place one or more shapes on the canvas. Each shape has a type, position, size, optional text, and optional style overrides.",
		parameters: {
			type: "object",
			properties: {
				shapes: {
					type: "array",
					items: {
						type: "object",
						properties: {
							type: {
								type: "string",
								description:
									"Shape type. Must be one of the available types from the canvas context.",
							},
							x: { type: "number", description: "X position (left edge)" },
							y: { type: "number", description: "Y position (top edge)" },
							width: {
								type: "number",
								description: "Width in pixels",
							},
							height: {
								type: "number",
								description: "Height in pixels",
							},
							text: {
								type: "string",
								description: "Text content. Required for type 'text'. The actual displayed string.",
							},
							fontSize: {
								type: "number",
								description: "Font size in px (for text shapes). Default 16.",
							},
							style: {
								type: "object",
								description: "Optional style overrides",
								properties: {
									fill: {
										type: "string",
										description: "Fill color (hex)",
									},
									stroke: {
										type: "string",
										description: "Stroke color (hex)",
									},
									strokeWidth: {
										type: "number",
										description: "Stroke width in px",
									},
									opacity: {
										type: "number",
										description: "Opacity 0-1",
									},
								},
							},
						},
						required: ["type", "x", "y", "width", "height"],
					},
				},
			},
			required: ["shapes"],
		},
	},
};

interface PlaceShapeItem {
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	text?: string;
	fontSize?: number;
	style?: {
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
	};
}

// POST /api/ai/complete — AIによるシェイプ生成
aiApp.post("/complete", zValidator("json", completeSchema), async (c) => {
	const { prompt, canvasContext, boardId, model } = c.req.valid("json");

	const apiKey = c.env.OPENAI_API_KEY;
	if (!apiKey) {
		return c.json({ error: "OPENAI_API_KEY is not configured" }, 500);
	}

	return streamSSE(c, async (stream) => {
		try {
			// 1. Thinking状態を通知
			await stream.writeSSE({
				event: "status",
				data: JSON.stringify({ status: "thinking" }),
			});

			// 2. OpenAI API呼び出し
			const response = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages: [
						{ role: "system", content: SYSTEM_PROMPT },
						{
							role: "user",
							content: `Canvas context:\n${canvasContext}\n\nUser request: ${prompt}`,
						},
					],
					tools: [PLACE_SHAPES_TOOL],
					tool_choice: {
						type: "function",
						function: { name: "place_shapes" },
					},
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({
						message: `OpenAI API error: ${response.status} ${errorText}`,
					}),
				});
				return;
			}

			const result = (await response.json()) as {
				choices: Array<{
					message: {
						tool_calls?: Array<{
							function: { name: string; arguments: string };
						}>;
					};
				}>;
			};

			const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
			if (!toolCall || toolCall.function.name !== "place_shapes") {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({
						message: "AI did not produce shape placement",
					}),
				});
				return;
			}

			const args = JSON.parse(toolCall.function.arguments) as {
				shapes: PlaceShapeItem[];
			};
			const shapes = args.shapes;

			if (!shapes || shapes.length === 0) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({ message: "AI produced no shapes" }),
				});
				return;
			}

			// 3. Placing状態を通知
			await stream.writeSSE({
				event: "status",
				data: JSON.stringify({
					status: "placing",
					shapeCount: shapes.length,
				}),
			});

			// 4. BoardRoom DOにHTTP経由でシェイプ配置を転送
			const doId = c.env.BOARD_ROOM.idFromName(boardId);
			const room = c.env.BOARD_ROOM.get(doId);
			const placeResponse = await room.fetch(
				new Request("http://do/ai-place-shapes", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ shapes }),
				}),
			);

			if (!placeResponse.ok) {
				const errText = await placeResponse.text();
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({
						message: `Failed to place shapes: ${errText}`,
					}),
				});
				return;
			}

			const placed = (await placeResponse.json()) as {
				placedShapes: Array<{
					id: string;
					type: string;
					x: number;
					y: number;
					width: number;
					height: number;
				}>;
			};

			// 5. 完了通知
			await stream.writeSSE({
				event: "result",
				data: JSON.stringify({ shapes: placed.placedShapes }),
			});
		} catch (err) {
			await stream.writeSSE({
				event: "error",
				data: JSON.stringify({
					message: err instanceof Error ? err.message : "Unknown error",
				}),
			});
		}
	});
});

export { aiApp };
