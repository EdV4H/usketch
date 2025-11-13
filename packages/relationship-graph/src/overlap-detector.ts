/**
 * OverlapDetector
 *
 * 形状間の重なり判定ユーティリティ
 */

import type { Bounds, Shape } from "@usketch/shared-types";

/**
 * 形状のバウンディングボックスを取得
 */
function getBounds(shape: Shape): Bounds {
	// 基本的な形状のバウンディングボックス
	if ("width" in shape && "height" in shape) {
		return {
			x: shape.x,
			y: shape.y,
			width: shape.width,
			height: shape.height,
		};
	}

	// LineShapeの場合
	if (shape.type === "line" && "x2" in shape && "y2" in shape) {
		const minX = Math.min(shape.x, shape.x2);
		const minY = Math.min(shape.y, shape.y2);
		const maxX = Math.max(shape.x, shape.x2);
		const maxY = Math.max(shape.y, shape.y2);
		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}

	// デフォルト（点として扱う）
	return {
		x: shape.x,
		y: shape.y,
		width: 0,
		height: 0,
	};
}

/**
 * 重なり判定ユーティリティ
 */
export class OverlapDetector {
	/**
	 * 親が子を完全に内包しているか
	 */
	static contains(parent: Shape, child: Shape): boolean {
		const parentBounds = getBounds(parent);
		const childBounds = getBounds(child);

		return (
			childBounds.x >= parentBounds.x &&
			childBounds.y >= parentBounds.y &&
			childBounds.x + childBounds.width <= parentBounds.x + parentBounds.width &&
			childBounds.y + childBounds.height <= parentBounds.y + parentBounds.height
		);
	}

	/**
	 * 2つの形状が部分的に重なっているか
	 */
	static intersects(parent: Shape, child: Shape): boolean {
		const parentBounds = getBounds(parent);
		const childBounds = getBounds(child);

		return !(
			childBounds.x + childBounds.width < parentBounds.x ||
			childBounds.x > parentBounds.x + parentBounds.width ||
			childBounds.y + childBounds.height < parentBounds.y ||
			childBounds.y > parentBounds.y + parentBounds.height
		);
	}

	/**
	 * 子の中心点が親の内側にあるか
	 */
	static centerInside(parent: Shape, child: Shape): boolean {
		const parentBounds = getBounds(parent);
		const childBounds = getBounds(child);

		const centerX = childBounds.x + childBounds.width / 2;
		const centerY = childBounds.y + childBounds.height / 2;

		return (
			centerX >= parentBounds.x &&
			centerX <= parentBounds.x + parentBounds.width &&
			centerY >= parentBounds.y &&
			centerY <= parentBounds.y + parentBounds.height
		);
	}

	/**
	 * 重なりタイプを判定
	 */
	static getOverlapType(
		parent: Shape,
		child: Shape,
	): "contains" | "intersects" | "center-inside" | null {
		if (OverlapDetector.contains(parent, child)) return "contains";
		if (OverlapDetector.centerInside(parent, child)) return "center-inside";
		if (OverlapDetector.intersects(parent, child)) return "intersects";
		return null;
	}
}
