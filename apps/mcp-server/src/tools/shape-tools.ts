/**
 * シェイプ操作ツール
 * shape_list, shape_get, shape_create, shape_update, shape_delete
 *
 * Y.Doc を直接操作し、WebSocket 経由でリアルタイム同期する
 */

import { DEFAULT_STYLE } from "@edv4h/usketch-shared";
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
				'シェイプタイプ: "rectangle" | "ellipse" | "text" | "board-portal" | "freedraw" 等',
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
					// カスタムプロパティを反映
					for (const [key, value] of Object.entries(extra)) {
						if (value !== undefined) updated[key] = value;
					}

					shapesMap.set(id, updated);
					updatedIds.push(id);
				}
			});

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
