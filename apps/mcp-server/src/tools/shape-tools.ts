/**
 * シェイプ操作ツール
 * shape_list, shape_get, shape_create, shape_update, shape_delete
 *
 * Y.Doc を直接操作し、WebSocket 経由でリアルタイム同期する
 */

import { DEFAULT_STYLE, type ShapeData } from "@edv4h/usketch-shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connection-manager.js";

const styleSchema = z
	.object({
		fill: z.string().optional(),
		stroke: z.string().optional(),
		strokeWidth: z.number().optional(),
		opacity: z.number().min(0).max(1).optional(),
	})
	.optional();

const shapeInputSchema = z
	.object({
		type: z
			.string()
			.describe(
				'シェイプタイプ: "rectangle" | "rounded-rect" | "ellipse" | "triangle" | "diamond" | "star" | "arrow" | "line" | "text" | "board-portal" | "freedraw" | "group" | "frame" | "connector" + wireframe系21種。' +
					"group→childrenIds不要(別途parentIdで管理) / frame→frameTitle(string) / connector→sourceId,targetId,sourceAnchor,targetAnchor,arrowHead,pathType。" +
					"[Form] wireframe-button(label,variant) / wireframe-input(placeholder,inputLabel,inputType) / wireframe-select(placeholder,options[]) / wireframe-checkbox(checkboxLabel,checked). " +
					"[Nav] wireframe-navbar(items[],brand) / wireframe-tabs(tabs[],activeIndex) / wireframe-breadcrumb(items[]) / wireframe-sidebar(items[],sidebarTitle). " +
					"[Content] wireframe-card(cardTitle,cardContent) / wireframe-avatar(avatarLabel) / wireframe-image(imageAlt) / wireframe-badge(badgeLabel,badgeVariant) / wireframe-table(columns[],rows) / wireframe-list(listItems[]). " +
					"[Feedback] wireframe-alert(alertMessage,alertType) / wireframe-modal(modalTitle,modalContent) / wireframe-toast(toastMessage,toastType) / wireframe-progress(progress,progressLabel). " +
					"[Layout] wireframe-container(containerTitle,borderStyle) / wireframe-divider(dividerStyle) / wireframe-accordion(sections[],expandedIndex).",
			),
		x: z.number().describe("X座標"),
		y: z.number().describe("Y座標"),
		width: z.number().min(0).max(10000).describe("幅"),
		height: z.number().min(0).max(10000).describe("高さ"),
		text: z.string().max(1000).optional().describe("テキスト内容"),
		fontSize: z.number().min(8).max(256).optional().describe("フォントサイズ"),
		style: styleSchema.describe("スタイル (fill, stroke, strokeWidth, opacity)"),
	})
	.passthrough();

const shapeUpdateSchema = z
	.object({
		id: z.string().describe("更新対象のシェイプID"),
		x: z.number().optional(),
		y: z.number().optional(),
		width: z.number().min(0).max(10000).optional(),
		height: z.number().min(0).max(10000).optional(),
		text: z.string().max(1000).optional(),
		fontSize: z.number().min(8).max(256).optional(),
		style: styleSchema,
	})
	.passthrough();

/** Centre of the union bounding box of some boxes, for placing the AI presence cursor. */
function centroidOf(
	boxes: Array<{ x: number; y: number; width: number; height: number }>,
): { x: number; y: number } | undefined {
	if (boxes.length === 0) return undefined;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const b of boxes) {
		minX = Math.min(minX, b.x);
		minY = Math.min(minY, b.y);
		maxX = Math.max(maxX, b.x + b.width);
		maxY = Math.max(maxY, b.y + b.height);
	}
	return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function registerShapeTools(server: McpServer, connections: ConnectionManager): void {
	server.tool(
		"shape_list",
		"ボード上の全シェイプ一覧を取得",
		{ boardId: z.string().describe("ボードID") },
		async ({ boardId }) => {
			const conn = await connections.getConnection(boardId);
			const shapes = conn.getAllShapes();
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(shapes, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"shape_get",
		"特定のシェイプを取得",
		{
			boardId: z.string().describe("ボードID"),
			shapeId: z.string().describe("シェイプID"),
		},
		async ({ boardId, shapeId }) => {
			const conn = await connections.getConnection(boardId);
			const shape = conn.getShape(shapeId);
			if (!shape) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Shape not found: ${shapeId}`,
						},
					],
					isError: true,
				};
			}
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(shape, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"shape_create",
		"シェイプを作成（複数可）。作成されたシェイプはリアルタイムにキャンバスに反映される",
		{
			boardId: z.string().describe("ボードID"),
			shapes: z.array(shapeInputSchema).min(1).max(50).describe("作成するシェイプの配列"),
		},
		async ({ boardId, shapes }) => {
			const conn = await connections.getConnection(boardId);
			const shapesMap = conn.getShapesMap();
			const placedShapes: Array<{ id: string; type: string }> = [];

			conn.doc.transact(() => {
				for (const shape of shapes) {
					const id = crypto.randomUUID();
					const baseStyle =
						shape.type === "text"
							? { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 }
							: DEFAULT_STYLE;
					const { type, x, y, width, height, text, fontSize, style: inputStyle, ...extra } = shape;
					const style = { ...baseStyle, ...inputStyle };

					const shapeData: Record<string, unknown> = {
						...extra,
						id,
						type,
						x,
						y,
						width,
						height,
						style,
					};

					if (text !== undefined) {
						shapeData.text = text;
					}
					if (type === "text") {
						shapeData.fontSize = fontSize ?? 16;
						shapeData.fontFamily = "system-ui, sans-serif";
						shapeData.isEditing = false;
					}

					shapesMap.set(id, shapeData);
					placedShapes.push({ id, type });
				}
			});

			// Show it as an AI participant editing these shapes (feature #960).
			if (placedShapes.length > 0) {
				conn.showAiActivity({
					shapeIds: placedShapes.map((s) => s.id),
					action: "edit",
					cursor: centroidOf(shapes),
				});
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ created: placedShapes.length, shapes: placedShapes }, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"shape_update",
		"シェイプを更新（複数可）。変更はリアルタイムにキャンバスに反映される",
		{
			boardId: z.string().describe("ボードID"),
			updates: z.array(shapeUpdateSchema).min(1).max(50).describe("更新内容の配列"),
		},
		async ({ boardId, updates }) => {
			const conn = await connections.getConnection(boardId);
			const shapesMap = conn.getShapesMap();
			const updatedIds: string[] = [];
			const notFound: string[] = [];

			conn.doc.transact(() => {
				for (const update of updates) {
					const existing = shapesMap.get(update.id);
					if (!existing) {
						notFound.push(update.id);
						continue;
					}

					const { id, x, y, width, height, text, fontSize, style: updateStyle, ...extra } = update;
					const updated: Record<string, unknown> = { ...existing };
					if (x !== undefined) updated.x = x;
					if (y !== undefined) updated.y = y;
					if (width !== undefined) updated.width = width;
					if (height !== undefined) updated.height = height;
					if (text !== undefined) updated.text = text;
					if (fontSize !== undefined) updated.fontSize = fontSize;
					if (updateStyle !== undefined) {
						const existingStyle = (existing.style ?? {}) as Record<string, unknown>;
						updated.style = { ...existingStyle, ...updateStyle };
					}
					// カスタムプロパティを反映（予約キーは除外）
					const reservedKeys = new Set([
						"id",
						"type",
						"x",
						"y",
						"width",
						"height",
						"text",
						"fontSize",
						"style",
					]);
					for (const [key, value] of Object.entries(extra)) {
						if (value !== undefined && !reservedKeys.has(key)) updated[key] = value;
					}

					shapesMap.set(id, updated);
					updatedIds.push(id);
				}
			});

			// Show it as an AI participant editing these shapes (feature #960).
			if (updatedIds.length > 0) {
				const boxes = updatedIds
					.map((id) => conn.getShape(id))
					.filter((s): s is ShapeData => Boolean(s))
					.map((s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }));
				conn.showAiActivity({ shapeIds: updatedIds, action: "edit", cursor: centroidOf(boxes) });
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ updated: updatedIds.length, updatedIds, notFound }, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"shape_delete",
		"シェイプを削除（複数可）。削除はリアルタイムにキャンバスに反映される",
		{
			boardId: z.string().describe("ボードID"),
			shapeIds: z.array(z.string()).min(1).describe("削除するシェイプIDの配列"),
		},
		async ({ boardId, shapeIds }) => {
			const conn = await connections.getConnection(boardId);
			const shapesMap = conn.getShapesMap();
			const deleted: string[] = [];
			const notFound: string[] = [];

			// Capture bounds BEFORE deletion so the AI cursor can point at where it acted.
			const delBoxes = shapeIds
				.map((id) => conn.getShape(id))
				.filter((s): s is ShapeData => Boolean(s))
				.map((s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }));

			conn.doc.transact(() => {
				for (const id of shapeIds) {
					if (shapesMap.has(id)) {
						shapesMap.delete(id);
						deleted.push(id);
					} else {
						notFound.push(id);
					}
				}
			});

			// The shapes are gone, so no outline — just show the AI cursor at the spot.
			if (deleted.length > 0) conn.showAiActivity({ cursor: centroidOf(delBoxes) });

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{ deleted: deleted.length, deletedIds: deleted, notFound },
							null,
							2,
						),
					},
				],
			};
		},
	);
}
