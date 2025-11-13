/**
 * 基本エフェクトハンドラ
 *
 * 親子関係における基本的な振る舞いを実装
 */

import type { Shape } from "@usketch/shared-types";

/**
 * move-with-parent エフェクト
 * 親の移動に追従
 *
 * @param parent 親形状
 * @param child 子形状
 * @param config エフェクト設定（deltaX, deltaYを含む）
 * @param shapes 全形状のマップ
 * @returns 更新された子形状、または変更なしの場合null
 */
export function applyMoveWithParent(
	_parent: Shape,
	child: Shape,
	config: Record<string, unknown> | undefined,
	_shapes: Record<string, Shape>,
): Shape | null {
	// configから移動量を取得
	const deltaX = (config?.["deltaX"] as number) ?? 0;
	const deltaY = (config?.["deltaY"] as number) ?? 0;

	if (deltaX === 0 && deltaY === 0) {
		return null; // 移動なし
	}

	return {
		...child,
		x: child.x + deltaX,
		y: child.y + deltaY,
	};
}

/**
 * rotate-with-parent エフェクト
 * 親の回転に追従
 *
 * @param parent 親形状
 * @param child 子形状
 * @param config エフェクト設定（deltaRotationを含む）
 * @param shapes 全形状のマップ
 * @returns 更新された子形状、または変更なしの場合null
 */
export function applyRotateWithParent(
	parent: Shape,
	child: Shape,
	config: Record<string, unknown> | undefined,
	_shapes: Record<string, Shape>,
): Shape | null {
	// configから回転量を取得
	const deltaRotation = (config?.["deltaRotation"] as number) ?? 0;

	if (deltaRotation === 0) {
		return null; // 回転なし
	}

	// 親の中心を軸に子を回転
	const parentCenterX = parent.x + ("width" in parent ? parent.width : 0) / 2;
	const parentCenterY = parent.y + ("height" in parent ? parent.height : 0) / 2;

	// 子の中心から親の中心への相対位置
	const childCenterX = child.x + ("width" in child ? child.width : 0) / 2;
	const childCenterY = child.y + ("height" in child ? child.height : 0) / 2;

	const relativeX = childCenterX - parentCenterX;
	const relativeY = childCenterY - parentCenterY;

	// 回転行列を適用
	const cosTheta = Math.cos(deltaRotation);
	const sinTheta = Math.sin(deltaRotation);

	const rotatedX = relativeX * cosTheta - relativeY * sinTheta;
	const rotatedY = relativeX * sinTheta + relativeY * cosTheta;

	// 新しい位置を計算
	const newCenterX = parentCenterX + rotatedX;
	const newCenterY = parentCenterY + rotatedY;

	const newX = newCenterX - ("width" in child ? child.width : 0) / 2;
	const newY = newCenterY - ("height" in child ? child.height : 0) / 2;

	return {
		...child,
		x: newX,
		y: newY,
		rotation: child.rotation + deltaRotation,
	};
}

/**
 * resize-with-parent エフェクト
 * 親のリサイズに追従
 *
 * @param parent 親形状
 * @param child 子形状
 * @param config エフェクト設定（scaleX, scaleYを含む）
 * @param shapes 全形状のマップ
 * @returns 更新された子形状、または変更なしの場合null
 */
export function applyResizeWithParent(
	parent: Shape,
	child: Shape,
	config: Record<string, unknown> | undefined,
	_shapes: Record<string, Shape>,
): Shape | null {
	const scaleX = (config?.["scaleX"] as number) ?? 1;
	const scaleY = (config?.["scaleY"] as number) ?? 1;

	if (scaleX === 1 && scaleY === 1) {
		return null; // スケール変更なし
	}

	// 親の左上を基準に子の位置とサイズをスケーリング
	const relativeX = child.x - parent.x;
	const relativeY = child.y - parent.y;

	const newX = parent.x + relativeX * scaleX;
	const newY = parent.y + relativeY * scaleY;

	// 子のサイズもスケーリング（width/heightを持つ場合）
	if ("width" in child && "height" in child) {
		return {
			...child,
			x: newX,
			y: newY,
			width: child.width * scaleX,
			height: child.height * scaleY,
		} as Shape;
	}

	return {
		...child,
		x: newX,
		y: newY,
	};
}

/**
 * clip-by-parent エフェクト
 * 親の境界でクリップ
 *
 * SVGのclipPathを使用するため、Shapeオブジェクト自体は変更不要
 * レンダリング時にclipPath属性を適用する
 *
 * @returns null（レンダリング時に処理）
 */
export function applyClipByParent(
	_parent: Shape,
	_child: Shape,
	_config: Record<string, unknown> | undefined,
	_shapes: Record<string, Shape>,
): Shape | null {
	// クリッピングはレンダリング時にSVGのclipPathで実装
	// Shapeオブジェクト自体は変更不要
	return null;
}
