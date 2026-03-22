import type { ShapeData, Viewport } from "@edv4h/usketch-shared";

/**
 * キャンバスの状態をAI向けのプロンプト文字列にシリアライズする。
 * ビューポート内のシェイプを優先し、推定8000トークンを超える場合はビューポート内のみに絞る。
 */
export function canvasToPrompt(
	shapes: ReadonlyMap<string, ShapeData>,
	viewport: Viewport,
	availableTypes: string[],
): string {
	const viewportCenter = {
		x: Math.round(
			-viewport.x / viewport.zoom +
				(typeof window !== "undefined" ? window.innerWidth / 2 / viewport.zoom : 500),
		),
		y: Math.round(
			-viewport.y / viewport.zoom +
				(typeof window !== "undefined" ? window.innerHeight / 2 / viewport.zoom : 400),
		),
	};

	const viewportBounds = {
		x: -viewport.x / viewport.zoom,
		y: -viewport.y / viewport.zoom,
		width: (typeof window !== "undefined" ? window.innerWidth : 1000) / viewport.zoom,
		height: (typeof window !== "undefined" ? window.innerHeight : 800) / viewport.zoom,
	};

	const allShapes: Array<Record<string, unknown>> = [];
	const viewportShapes: Array<Record<string, unknown>> = [];

	for (const [, shape] of shapes) {
		const serialized = serializeShape(shape);

		allShapes.push(serialized);

		// ビューポート内判定
		if (
			shape.x + shape.width >= viewportBounds.x &&
			shape.x <= viewportBounds.x + viewportBounds.width &&
			shape.y + shape.height >= viewportBounds.y &&
			shape.y <= viewportBounds.y + viewportBounds.height
		) {
			viewportShapes.push(serialized);
		}
	}

	// 推定トークン数（JSON文字数 / 4）で判定
	const allJson = JSON.stringify(allShapes);
	const useAll = allJson.length / 4 < 8000;
	const shapesToSend = useAll ? allShapes : viewportShapes;

	const context = {
		viewportCenter,
		availableShapeTypes: availableTypes,
		existingShapes: shapesToSend,
		shapeCount: shapes.size,
		visibleShapeCount: viewportShapes.length,
	};

	return JSON.stringify(context);
}

function serializeShape(shape: ShapeData): Record<string, unknown> {
	const result: Record<string, unknown> = {
		id: shape.id,
		type: shape.type,
		x: Math.round(shape.x),
		y: Math.round(shape.y),
		w: Math.round(shape.width),
		h: Math.round(shape.height),
	};

	// freedrawはpointCountのみ
	if (shape.type === "freedraw" && Array.isArray(shape.points)) {
		result.pointCount = (shape.points as unknown[]).length;
	} else {
		// type固有フィールド
		if (shape.text) result.text = shape.text;
		if (shape.cornerRadius) result.cornerRadius = shape.cornerRadius;
	}

	// default styleと異なる場合のみスタイルを含める
	const style = shape.style;
	if (style) {
		const overrides: Record<string, unknown> = {};
		if (style.fill !== "#ffffff") overrides.fill = style.fill;
		if (style.stroke !== "#1e1e1e") overrides.stroke = style.stroke;
		if (style.strokeWidth !== 2) overrides.strokeWidth = style.strokeWidth;
		if (style.opacity !== 1) overrides.opacity = style.opacity;
		if (Object.keys(overrides).length > 0) result.style = overrides;
	}

	return result;
}
