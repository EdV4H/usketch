import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { boardMembers, boards } from "../db/schema.js";
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
	image: z.string().max(10_000_000).optional(),
	model: z.string().optional().default("gpt-4o"),
});

/** シェイプ数の上限 */
const MAX_SHAPES_PER_REQUEST = 50;

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

const MODIFY_SHAPES_TOOL = {
	type: "function" as const,
	function: {
		name: "modify_shapes",
		description:
			"Update existing shapes on the canvas. Each update targets a shape by ID and can change position, size, text, or style.",
		parameters: {
			type: "object",
			properties: {
				updates: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: {
								type: "string",
								description: "The shape ID to update",
							},
							x: { type: "number", description: "New X position (left edge)" },
							y: { type: "number", description: "New Y position (top edge)" },
							width: {
								type: "number",
								description: "New width in pixels",
							},
							height: {
								type: "number",
								description: "New height in pixels",
							},
							text: {
								type: "string",
								description: "New text content",
							},
							fontSize: {
								type: "number",
								description: "New font size in px",
							},
							style: {
								type: "object",
								description: "Style overrides",
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
						required: ["id"],
					},
				},
			},
			required: ["updates"],
		},
	},
};

interface ModifyShapeItem {
	id: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	text?: string;
	fontSize?: number;
	style?: {
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
	};
}

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

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_TEXT_LENGTH = 1000;

/** LLM出力のシェイプをバリデーション・サニタイズする（未知フィールドは除去） */
function validateShapes(raw: PlaceShapeItem[]): PlaceShapeItem[] {
	const clamped = raw.slice(0, MAX_SHAPES_PER_REQUEST);
	const valid: PlaceShapeItem[] = [];
	for (const s of clamped) {
		if (typeof s.type !== "string" || !s.type) continue;
		const x = Number.isFinite(s.x) ? s.x : 0;
		const y = Number.isFinite(s.y) ? s.y : 0;
		const width = Number.isFinite(s.width) && s.width > 0 ? Math.min(s.width, 10000) : 100;
		const height = Number.isFinite(s.height) && s.height > 0 ? Math.min(s.height, 10000) : 80;

		const sanitized: PlaceShapeItem = { type: s.type, x, y, width, height };

		// text
		if (typeof s.text === "string" && s.text.trim()) {
			sanitized.text = s.text.trim().slice(0, MAX_TEXT_LENGTH);
		}

		// fontSize
		if (Number.isFinite(s.fontSize)) {
			sanitized.fontSize = Math.min(256, Math.max(8, s.fontSize as number));
		}

		// style: 許可キーのみ、値をサニタイズ
		if (s.style && typeof s.style === "object") {
			const si = s.style;
			const so: PlaceShapeItem["style"] = {};
			if (
				typeof si.fill === "string" &&
				(HEX_COLOR_RE.test(si.fill) || si.fill === "transparent")
			) {
				so.fill = si.fill;
			}
			if (typeof si.stroke === "string" && HEX_COLOR_RE.test(si.stroke)) {
				so.stroke = si.stroke;
			}
			if (Number.isFinite(si.strokeWidth)) {
				so.strokeWidth = Math.min(100, Math.max(0, si.strokeWidth as number));
			}
			if (Number.isFinite(si.opacity)) {
				so.opacity = Math.min(1, Math.max(0, si.opacity as number));
			}
			if (Object.keys(so).length > 0) {
				sanitized.style = so;
			}
		}

		valid.push(sanitized);
	}
	return valid;
}

/** LLM出力のシェイプ更新をバリデーション・サニタイズする（未知フィールドは除去） */
function validateModifications(raw: ModifyShapeItem[]): ModifyShapeItem[] {
	const clamped = raw.slice(0, MAX_SHAPES_PER_REQUEST);
	const valid: ModifyShapeItem[] = [];
	for (const s of clamped) {
		if (typeof s.id !== "string" || !s.id) continue;

		const sanitized: ModifyShapeItem = { id: s.id };

		if (Number.isFinite(s.x)) sanitized.x = s.x;
		if (Number.isFinite(s.y)) sanitized.y = s.y;
		if (Number.isFinite(s.width) && (s.width as number) > 0) {
			sanitized.width = Math.min(s.width as number, 10000);
		}
		if (Number.isFinite(s.height) && (s.height as number) > 0) {
			sanitized.height = Math.min(s.height as number, 10000);
		}

		// text
		if (typeof s.text === "string" && s.text.trim()) {
			sanitized.text = s.text.trim().slice(0, MAX_TEXT_LENGTH);
		}

		// fontSize
		if (Number.isFinite(s.fontSize)) {
			sanitized.fontSize = Math.min(256, Math.max(8, s.fontSize as number));
		}

		// style: 許可キーのみ、値をサニタイズ
		if (s.style && typeof s.style === "object") {
			const si = s.style;
			const so: ModifyShapeItem["style"] = {};
			if (
				typeof si.fill === "string" &&
				(HEX_COLOR_RE.test(si.fill) || si.fill === "transparent")
			) {
				so.fill = si.fill;
			}
			if (typeof si.stroke === "string" && HEX_COLOR_RE.test(si.stroke)) {
				so.stroke = si.stroke;
			}
			if (Number.isFinite(si.strokeWidth)) {
				so.strokeWidth = Math.min(100, Math.max(0, si.strokeWidth as number));
			}
			if (Number.isFinite(si.opacity)) {
				so.opacity = Math.min(1, Math.max(0, si.opacity as number));
			}
			if (Object.keys(so).length > 0) {
				sanitized.style = so;
			}
		}

		valid.push(sanitized);
	}
	return valid;
}

const SMART_ACTIONS_ADDENDUM = `

When the user asks to modify existing shapes (tidy, label, translate, etc.):
- Use modify_shapes to update existing shapes by their ID
- For "tidy": Rearrange shapes into a clean grid or flow layout. Align edges, equalize spacing.
- For "label": Add new text shapes near unlabeled shapes to describe them.
- For "translate": Update the text content of text shapes to the target language.
- You can use BOTH place_shapes (to add new shapes) AND modify_shapes (to update existing) in the same response.`;

// POST /api/ai/complete — AIによるシェイプ生成
aiApp.post("/complete", zValidator("json", completeSchema), async (c) => {
	const { prompt, canvasContext, boardId, image, model } = c.req.valid("json");
	const userId = c.get("userId");

	// ボードアクセス制御: メンバーまたは公開ボードのみ許可
	const db = c.get("db");
	const result = await db
		.select({
			isPublic: boards.isPublic,
			role: boardMembers.role,
		})
		.from(boards)
		.leftJoin(
			boardMembers,
			and(eq(boards.id, boardMembers.boardId), eq(boardMembers.userId, userId)),
		)
		.where(eq(boards.id, boardId))
		.limit(1);

	if (result.length === 0 || (result[0].role === null && !result[0].isPublic)) {
		return c.json({ error: "Not found" }, 404);
	}

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

			// 2. システムプロンプトを構築（選択シェイプがある場合はアドオン追加）
			let hasSelectedShapes = false;
			try {
				const parsed = JSON.parse(canvasContext);
				hasSelectedShapes =
					Array.isArray(parsed.selectedShapes) && parsed.selectedShapes.length > 0;
			} catch {
				// パース失敗時は選択なしとみなす
			}
			const systemPrompt = hasSelectedShapes
				? SYSTEM_PROMPT + SMART_ACTIONS_ADDENDUM
				: SYSTEM_PROMPT;

			// 3. OpenAI API呼び出し
			const userContent = image
				? [
						{
							type: "text" as const,
							text: `Canvas context:\n${canvasContext}\n\nUser request: ${prompt}`,
						},
						{
							type: "image_url" as const,
							image_url: { url: image, detail: "low" as const },
						},
					]
				: `Canvas context:\n${canvasContext}\n\nUser request: ${prompt}`;

			const response = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages: [
						{ role: "system", content: systemPrompt },
						{ role: "user", content: userContent },
					],
					tools: [PLACE_SHAPES_TOOL, MODIFY_SHAPES_TOOL],
					// 画像付きリクエストではplace_shapesを強制（テキスト応答のみ返却を防止）
					tool_choice: image ? { type: "function", function: { name: "place_shapes" } } : "auto",
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

			const apiResult = (await response.json()) as {
				choices: Array<{
					message: {
						tool_calls?: Array<{
							function: { name: string; arguments: string };
						}>;
					};
				}>;
			};

			const toolCalls = apiResult.choices?.[0]?.message?.tool_calls ?? [];
			if (toolCalls.length === 0) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({
						message: "AI did not produce shape placement",
					}),
				});
				return;
			}

			const doId = c.env.BOARD_ROOM.idFromName(boardId);
			const room = c.env.BOARD_ROOM.get(doId);

			// 全tool_callの結果を集約してから1回のresultイベントで送信
			const allPlacedShapes: Array<{
				id: string;
				type: string;
				x: number;
				y: number;
				width: number;
				height: number;
			}> = [];
			let totalCount = 0;

			for (const toolCall of toolCalls) {
				const fnName = toolCall.function.name;

				if (fnName === "place_shapes") {
					const args = JSON.parse(toolCall.function.arguments) as {
						shapes: PlaceShapeItem[];
					};
					const shapes = validateShapes(args.shapes ?? []);
					if (shapes.length === 0) continue;

					totalCount += shapes.length;
					await stream.writeSSE({
						event: "status",
						data: JSON.stringify({
							status: "placing",
							shapeCount: totalCount,
							message: `Placing ${shapes.length} shapes...`,
						}),
					});

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
					allPlacedShapes.push(...placed.placedShapes);
				} else if (fnName === "modify_shapes") {
					const args = JSON.parse(toolCall.function.arguments) as {
						updates: ModifyShapeItem[];
					};
					const updates = validateModifications(args.updates ?? []);
					if (updates.length === 0) continue;

					totalCount += updates.length;
					await stream.writeSSE({
						event: "status",
						data: JSON.stringify({
							status: "placing",
							shapeCount: totalCount,
							message: `Updating ${updates.length} shapes...`,
						}),
					});

					const updateResponse = await room.fetch(
						new Request("http://do/ai-update-shapes", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ updates }),
						}),
					);

					if (!updateResponse.ok) {
						const errText = await updateResponse.text();
						await stream.writeSSE({
							event: "error",
							data: JSON.stringify({
								message: `Failed to update shapes: ${errText}`,
							}),
						});
						return;
					}

					const { updatedShapes } = (await updateResponse.json()) as {
						updatedShapes: Array<{
							id: string;
							type: string;
							x: number;
							y: number;
							width: number;
							height: number;
						}>;
					};
					allPlacedShapes.push(...updatedShapes);
				}
			}

			if (allPlacedShapes.length === 0) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({ message: "AI produced no valid shapes" }),
				});
			} else {
				// 集約結果を1回のresultイベントで送信
				await stream.writeSSE({
					event: "result",
					data: JSON.stringify({ shapes: allPlacedShapes }),
				});
			}
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

// POST /api/ai/suggest — Copilot用: LLM提案のみ返す（Y.Docには書き込まない）
aiApp.post("/suggest", zValidator("json", completeSchema), async (c) => {
	const { prompt, canvasContext, boardId, image, model } = c.req.valid("json");
	const userId = c.get("userId");

	// ボードアクセス制御
	const db = c.get("db");
	const result = await db
		.select({ isPublic: boards.isPublic, role: boardMembers.role })
		.from(boards)
		.leftJoin(
			boardMembers,
			and(eq(boards.id, boardMembers.boardId), eq(boardMembers.userId, userId)),
		)
		.where(eq(boards.id, boardId))
		.limit(1);

	if (result.length === 0 || (result[0].role === null && !result[0].isPublic)) {
		return c.json({ error: "Not found" }, 404);
	}

	const apiKey = c.env.OPENAI_API_KEY;
	if (!apiKey) {
		return c.json({ error: "OPENAI_API_KEY is not configured" }, 500);
	}

	return streamSSE(c, async (stream) => {
		try {
			await stream.writeSSE({
				event: "status",
				data: JSON.stringify({ status: "thinking" }),
			});

			const suggestUserContent = image
				? [
						{
							type: "text" as const,
							text: `Canvas context:\n${canvasContext}\n\nUser request: ${prompt}`,
						},
						{
							type: "image_url" as const,
							image_url: { url: image, detail: "low" as const },
						},
					]
				: `Canvas context:\n${canvasContext}\n\nUser request: ${prompt}`;

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
						{ role: "user", content: suggestUserContent },
					],
					tools: [PLACE_SHAPES_TOOL],
					tool_choice: { type: "function", function: { name: "place_shapes" } },
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

			const apiResult = (await response.json()) as {
				choices: Array<{
					message: {
						tool_calls?: Array<{
							function: { name: string; arguments: string };
						}>;
					};
				}>;
			};

			const toolCall = apiResult.choices?.[0]?.message?.tool_calls?.[0];
			if (!toolCall || toolCall.function.name !== "place_shapes") {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({ message: "AI did not produce suggestions" }),
				});
				return;
			}

			const args = JSON.parse(toolCall.function.arguments) as {
				shapes: PlaceShapeItem[];
			};
			const shapes = validateShapes(args.shapes ?? []);

			// DOには書き込まず、提案としてそのまま返す
			await stream.writeSSE({
				event: "result",
				data: JSON.stringify({ shapes }),
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
