/**
 * レイヤー管理の型定義
 */

import type { Shape } from "./index";

/**
 * レイヤーメタデータ
 * 各形状に紐づくレイヤー情報
 */
export interface LayerMetadata {
	/** レイヤー名（未設定の場合は形状タイプから自動生成） */
	name?: string;
	/** 可視性 */
	visible: boolean;
	/** ロック状態（ロック時は選択・編集不可） */
	locked: boolean;
	/** 親グループID（グループ化されている場合） */
	parentId?: string;
	/** Z-index順での位置（小さいほど背面） */
	zIndex: number;
}

/**
 * グループ情報
 * 複数の形状をまとめて管理
 */
export interface ShapeGroup {
	/** グループID */
	id: string;
	/** グループ名 */
	name: string;
	/** グループに含まれる形状ID配列 */
	childIds: string[];
	/** 親グループID（ネストされたグループの場合） */
	parentId?: string;
	/** 可視性（グループ全体の表示/非表示） */
	visible: boolean;
	/** ロック状態（グループ全体のロック） */
	locked: boolean;
	/** 折りたたみ状態（UIでの表示用） */
	collapsed: boolean;
	/** Z-index順での位置 */
	zIndex: number;
}

/**
 * レイヤーツリーのノード
 * UIでの階層表示用
 */
export type LayerTreeNode =
	| { type: "shape"; shape: Shape; metadata: LayerMetadata }
	| { type: "group"; group: ShapeGroup };

/**
 * デフォルトのレイヤーメタデータ
 */
export const DEFAULT_LAYER_METADATA: LayerMetadata = {
	visible: true,
	locked: false,
	zIndex: 0,
};

/**
 * デフォルトのグループ生成関数
 */
export const createDefaultGroup = (name: string): Omit<ShapeGroup, "id"> => ({
	name,
	childIds: [],
	visible: true,
	locked: false,
	collapsed: false,
	zIndex: 0,
});
