/**
 * 高度なエフェクトハンドラ
 *
 * より複雑な親子関係の振る舞いを実装
 */

import type { Shape } from "@usketch/shared-types";

/**
 * inherit-style エフェクト
 * 親のスタイルを継承
 *
 * @param parent 親形状
 * @param child 子形状
 * @param config エフェクト設定（properties: 継承するプロパティ配列）
 * @param shapes 全形状のマップ
 * @returns 更新された子形状、または変更なしの場合null
 */
export function applyInheritStyle(
	parent: Shape,
	child: Shape,
	config: Record<string, unknown> | undefined,
	_shapes: Record<string, Shape>,
): Shape | null {
	const properties = (config?.["properties"] as string[]) ?? [];

	if (properties.length === 0) {
		return null;
	}

	const updates: Partial<Shape> = { ...child };
	let hasChanges = false;

	for (const prop of properties) {
		if (prop in parent && prop in updates) {
			// Type-safe dynamic property access with validation
			(updates as Record<string, unknown>)[prop] = (parent as Record<string, unknown>)[prop];
			hasChanges = true;
		}
	}

	return hasChanges ? (updates as Shape) : null;
}

/**
 * maintain-distance エフェクト
 * 親との距離を維持（コネクタ等）
 *
 * @param parent 親形状
 * @param child 子形状
 * @param config エフェクト設定（snapToEdge: エッジにスナップするか）
 * @param shapes 全形状のマップ
 * @returns 更新された子形状、または変更なしの場合null
 */
export function applyMaintainDistance(
	parent: Shape,
	child: Shape,
	config: Record<string, unknown> | undefined,
	_shapes: Record<string, Shape>,
): Shape | null {
	const snapToEdge = config?.["snapToEdge"] ?? false;

	// LineShapeの場合のみ処理
	if (child.type !== "line") {
		return null;
	}

	if (!snapToEdge) {
		return null;
	}

	// 親のバウンディングボックス
	const parentBounds = {
		x: parent.x,
		y: parent.y,
		width: "width" in parent ? parent.width : 0,
		height: "height" in parent ? parent.height : 0,
	};

	// 線の開始点を親の最寄りのエッジにスナップ
	const snappedPoint = findNearestEdgePoint(parentBounds, {
		x: child.x,
		y: child.y,
	});

	if (snappedPoint.x === child.x && snappedPoint.y === child.y) {
		return null; // 変更なし
	}

	return {
		...child,
		x: snappedPoint.x,
		y: snappedPoint.y,
	};
}

/**
 * auto-layout エフェクト
 * 自動レイアウト（Flexbox風）
 *
 * @param parent 親形状
 * @param child 子形状
 * @param config エフェクト設定（layoutType, direction, gap等）
 * @param shapes 全形状のマップ
 * @returns 更新された子形状、または変更なしの場合null
 */
export function applyAutoLayout(
	parent: Shape,
	child: Shape,
	config: Record<string, unknown> | undefined,
	_shapes: Record<string, Shape>,
): Shape | null {
	const layoutType = (config?.["layoutType"] as string) ?? "flex";

	if (layoutType === "flex") {
		// Flexboxライクな自動配置
		const direction = (config?.["direction"] as "row" | "column") ?? "row";
		// const gap = (config?.["gap"] as number) ?? 10; // TODO: Phase 3で実装
		const padding = (config?.["padding"] as number) ?? 16;

		// Phase 2では基本的な配置のみ実装
		// 実際には親の全子を取得して順番に配置する必要がある
		// ここでは単純に親の左上からpadding分オフセットした位置に配置

		if (direction === "row") {
			return {
				...child,
				x: parent.x + padding,
				y: parent.y + padding,
			};
		}
		return {
			...child,
			x: parent.x + padding,
			y: parent.y + padding,
		};
	}

	// その他のレイアウトタイプは未実装
	return null;
}

/**
 * 最寄りのエッジポイントを見つける
 */
function findNearestEdgePoint(
	bounds: { x: number; y: number; width: number; height: number },
	point: { x: number; y: number },
): { x: number; y: number } {
	// Validate bounds to prevent invalid calculations
	if (bounds.width <= 0 || bounds.height <= 0) {
		return point;
	}

	// 各エッジへの距離を計算
	const edges = [
		{ x: point.x, y: bounds.y }, // top
		{ x: bounds.x + bounds.width, y: point.y }, // right
		{ x: point.x, y: bounds.y + bounds.height }, // bottom
		{ x: bounds.x, y: point.y }, // left
	];

	const distances = edges.map((edge) =>
		Math.sqrt((edge.x - point.x) ** 2 + (edge.y - point.y) ** 2),
	);

	const minIndex = distances.indexOf(Math.min(...distances));
	return edges[minIndex] ?? point;
}
