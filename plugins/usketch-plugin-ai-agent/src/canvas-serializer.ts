import type { ShapeData, Viewport } from "@edv4h/usketch-shared";

/** 近接判定の閾値（px） */
const PROXIMITY_THRESHOLD = 20;

/**
 * キャンバスの状態をAI向けのプロンプト文字列にシリアライズする。
 * ビューポート内のシェイプを優先し、推定8000トークンを超える場合はビューポート内のみに絞る。
 */
export function canvasToPrompt(
	shapes: ReadonlyMap<string, ShapeData>,
	viewport: Viewport,
	availableTypes: string[],
	selectedIds?: ReadonlySet<string>,
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

	const context: Record<string, unknown> = {
		viewportCenter,
		availableShapeTypes: availableTypes,
		existingShapes: shapesToSend,
		shapeCount: shapes.size,
		visibleShapeCount: viewportShapes.length,
	};

	// 選択シェイプがある場合は詳細情報 + 空間関係を含める
	if (selectedIds && selectedIds.size > 0) {
		const selectedShapes: Array<Record<string, unknown>> = [];
		for (const id of selectedIds) {
			const shape = shapes.get(id);
			if (!shape) continue;
			const serialized = serializeShape(shape);

			// 近接テキストラベルを検出（textシェイプが選択シェイプの内部or近くにある場合）
			const nearbyLabels = findNearbyLabels(shape, shapes);
			if (nearbyLabels.length > 0) {
				serialized.nearbyLabels = nearbyLabels;
			}

			// 内包するシェイプを検出（選択シェイプの中に含まれるシェイプ）
			const containedShapes = findContainedShapes(shape, shapes, selectedIds);
			if (containedShapes.length > 0) {
				serialized.contains = containedShapes;
			}

			selectedShapes.push(serialized);
		}
		context.selectedShapes = selectedShapes;
	}

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

/**
 * 指定シェイプの近くにあるテキストシェイプを検出する。
 * テキストがシェイプの内部にある、または近接している場合にラベルとして扱う。
 */
function findNearbyLabels(
	target: ShapeData,
	allShapes: ReadonlyMap<string, ShapeData>,
): Array<{ id: string; text: string }> {
	const labels: Array<{ id: string; text: string }> = [];

	for (const [id, shape] of allShapes) {
		if (id === target.id) continue;
		if (shape.type !== "text") continue;
		if (!shape.text) continue;

		// テキストの中心がターゲットの内部 or 近くにあるか
		const textCx = shape.x + shape.width / 2;
		const textCy = shape.y + shape.height / 2;

		const isInside =
			textCx >= target.x &&
			textCx <= target.x + target.width &&
			textCy >= target.y &&
			textCy <= target.y + target.height;

		const isNearby =
			textCx >= target.x - PROXIMITY_THRESHOLD &&
			textCx <= target.x + target.width + PROXIMITY_THRESHOLD &&
			textCy >= target.y - PROXIMITY_THRESHOLD &&
			textCy <= target.y + target.height + PROXIMITY_THRESHOLD;

		if (isInside || isNearby) {
			labels.push({ id, text: shape.text as string });
		}
	}

	return labels;
}

/**
 * 指定シェイプの中に完全に含まれる非テキストシェイプを検出する。
 */
function findContainedShapes(
	container: ShapeData,
	allShapes: ReadonlyMap<string, ShapeData>,
	selectedIds: ReadonlySet<string>,
): Array<{ id: string; type: string }> {
	const contained: Array<{ id: string; type: string }> = [];

	for (const [id, shape] of allShapes) {
		if (id === container.id) continue;
		if (selectedIds.has(id)) continue; // 選択済みは除外
		if (shape.type === "text") continue; // テキストはnearbyLabelsで処理

		// 完全に内包されているか
		if (
			shape.x >= container.x &&
			shape.y >= container.y &&
			shape.x + shape.width <= container.x + container.width &&
			shape.y + shape.height <= container.y + container.height
		) {
			contained.push({ id, type: shape.type });
		}
	}

	return contained;
}
