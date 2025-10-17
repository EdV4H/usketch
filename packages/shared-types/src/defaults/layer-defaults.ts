/**
 * Layer Default Values
 *
 * Default values for layer metadata and groups.
 */

import type { LayerMetadata, ShapeGroup } from "../layer";

/**
 * デフォルトのレイヤーメタデータ
 */
export const DEFAULT_LAYER_METADATA: LayerMetadata = {
	visible: true,
	locked: false,
	zIndex: 0,
};

/**
 * デフォルトのグループを作成
 * @param name グループ名
 * @returns グループオブジェクト（idを除く）
 */
export const createDefaultGroup = (name: string): Omit<ShapeGroup, "id"> => ({
	name,
	childIds: [],
	visible: true,
	locked: false,
	collapsed: false,
	zIndex: 0,
});
