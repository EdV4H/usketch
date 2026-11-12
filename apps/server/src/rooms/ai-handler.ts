import { PageNotFoundError, type ShapesTarget } from "./board-shapes.js";

const DEFAULT_STYLE = {
	fill: "#ffffff",
	stroke: "#1e1e1e",
	strokeWidth: 2,
	opacity: 1,
};

function generateShapeId(): string {
	return crypto.randomUUID();
}

interface AiShapeInput {
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

interface AiShapeUpdate {
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

export interface AiHandlerDeps {
	/** 書き込み先の doc を開く（`pageId` 省略時はページを使うボードなら先頭ページ）。 */
	openShapes: (pageId: string | null) => Promise<ShapesTarget>;
}

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function readPageId(body: { pageId?: unknown }): string | null {
	return typeof body.pageId === "string" && body.pageId ? body.pageId : null;
}

function errorResponse(err: unknown): Response {
	if (err instanceof PageNotFoundError) return jsonResponse({ error: err.message }, 404);
	return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
}

/** `edit` の中で doc に入った update を集め、終わったら広める。 */
function transactAndPublish(target: ShapesTarget, edit: () => void): void {
	const { doc } = target;
	const pendingUpdates: Uint8Array[] = [];
	const onUpdate = (update: Uint8Array) => {
		pendingUpdates.push(update);
	};
	doc.on("update", onUpdate);
	try {
		doc.transact(edit);
	} finally {
		doc.off("update", onUpdate);
	}
	for (const update of pendingUpdates) target.publish(update);
}

/** AIシェイプ配置: Y.Docに書き込み → Yjs updateを全クライアントにbroadcast */
export async function handleAiPlaceShapes(
	request: Request,
	deps: AiHandlerDeps,
): Promise<Response> {
	try {
		const body = (await request.json()) as { shapes: AiShapeInput[]; pageId?: unknown };
		const shapes = body.shapes;
		if (!shapes || !Array.isArray(shapes) || shapes.length === 0) {
			return new Response(JSON.stringify({ error: "No shapes provided" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const target = await deps.openShapes(readPageId(body));
		const shapesMap = target.doc.getMap<Record<string, unknown>>("shapes");
		const placedShapes: Array<{
			id: string;
			type: string;
			x: number;
			y: number;
			width: number;
			height: number;
		}> = [];

		try {
			transactAndPublish(target, () => {
				for (const shape of shapes) {
					const id = generateShapeId();
					const baseStyle =
						shape.type === "text"
							? { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 }
							: DEFAULT_STYLE;
					const style = { ...baseStyle, ...shape.style };

					const shapeData: Record<string, unknown> = {
						id,
						type: shape.type,
						x: shape.x,
						y: shape.y,
						width: shape.width,
						height: shape.height,
						style,
					};

					if (shape.text !== undefined) {
						shapeData.text = shape.text;
					}
					if (shape.type === "text") {
						shapeData.fontSize = shape.fontSize ?? 16;
						shapeData.fontFamily = "system-ui, sans-serif";
						shapeData.isEditing = false;
					}

					shapesMap.set(id, shapeData);

					placedShapes.push({
						id,
						type: shape.type,
						x: shape.x,
						y: shape.y,
						width: shape.width,
						height: shape.height,
					});
				}
			});
		} finally {
			target.release();
		}

		return jsonResponse({ placedShapes, pageId: target.pageId }, 200);
	} catch (err) {
		return errorResponse(err);
	}
}

/** AIシェイプ更新: 既存シェイプのプロパティを更新 → Yjs updateを全クライアントにbroadcast */
export async function handleAiUpdateShapes(
	request: Request,
	deps: AiHandlerDeps,
): Promise<Response> {
	try {
		const body = (await request.json()) as { updates: AiShapeUpdate[]; pageId?: unknown };
		const updates = body.updates;
		if (!updates || !Array.isArray(updates) || updates.length === 0) {
			return new Response(JSON.stringify({ error: "No updates provided" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const target = await deps.openShapes(readPageId(body));
		const shapesMap = target.doc.getMap<Record<string, unknown>>("shapes");
		const updatedShapes: Array<{
			id: string;
			type: string;
			x: number;
			y: number;
			width: number;
			height: number;
		}> = [];

		try {
			transactAndPublish(target, () => {
				for (const update of updates) {
					const existing = shapesMap.get(update.id);
					if (!existing) continue;

					const updated: Record<string, unknown> = { ...existing };

					if (update.x !== undefined) updated.x = update.x;
					if (update.y !== undefined) updated.y = update.y;
					if (update.width !== undefined) updated.width = update.width;
					if (update.height !== undefined) updated.height = update.height;
					if (update.text !== undefined) updated.text = update.text;
					if (update.fontSize !== undefined) updated.fontSize = update.fontSize;

					if (update.style !== undefined) {
						const existingStyle = (existing.style ?? {}) as Record<string, unknown>;
						updated.style = { ...existingStyle, ...update.style };
					}

					shapesMap.set(update.id, updated);

					updatedShapes.push({
						id: update.id,
						type: updated.type as string,
						x: updated.x as number,
						y: updated.y as number,
						width: updated.width as number,
						height: updated.height as number,
					});
				}
			});
		} finally {
			target.release();
		}

		return jsonResponse({ updatedShapes, pageId: target.pageId }, 200);
	} catch (err) {
		return errorResponse(err);
	}
}
