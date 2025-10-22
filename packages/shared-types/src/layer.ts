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
 *
 * @deprecated GroupShapeに統合されました。後方互換性のために残していますが、
 * 新しいコードではGroupShapeを使用してください。
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
 * @deprecated createDefaultGroupShapeを使用してください
 */
export const createDefaultGroup = (name: string): Omit<ShapeGroup, "id"> => ({
	name,
	childIds: [],
	visible: true,
	locked: false,
	collapsed: false,
	zIndex: 0,
});

/**
 * デフォルトのGroupShape生成関数
 */
export const createDefaultGroupShape = (
	id: string,
	name: string,
	bounds: { x: number; y: number; width: number; height: number },
): import("./index").GroupShape => ({
	id,
	type: "group",
	name,
	childIds: [],
	collapsed: false,
	x: bounds.x,
	y: bounds.y,
	width: bounds.width,
	height: bounds.height,
	rotation: 0,
	opacity: 1,
	strokeColor: "transparent",
	fillColor: "transparent",
	strokeWidth: 0,
	layer: {
		visible: true,
		locked: false,
		zIndex: 0,
	},
});

/**
 * ShapeGroup → GroupShape への変換
 * 後方互換性のためのヘルパー関数
 */
export const shapeGroupToGroupShape = (
	group: ShapeGroup,
	bounds: { x: number; y: number; width: number; height: number } = {
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	},
): import("./index").GroupShape => {
	const layer: LayerMetadata = {
		visible: group.visible,
		locked: group.locked,
		zIndex: group.zIndex,
	};
	if (group.parentId !== undefined) {
		layer.parentId = group.parentId;
	}
	return {
		id: group.id,
		type: "group",
		name: group.name,
		childIds: group.childIds,
		collapsed: group.collapsed,
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
		rotation: 0,
		opacity: 1,
		strokeColor: "transparent",
		fillColor: "transparent",
		strokeWidth: 0,
		layer,
	};
};

/**
 * GroupShape → ShapeGroup への変換
 * 後方互換性のためのヘルパー関数
 */
export const groupShapeToShapeGroup = (shape: import("./index").GroupShape): ShapeGroup => {
	const group: ShapeGroup = {
		id: shape.id,
		name: shape.name,
		childIds: shape.childIds,
		collapsed: shape.collapsed,
		visible: shape.layer?.visible ?? true,
		locked: shape.layer?.locked ?? false,
		zIndex: shape.layer?.zIndex ?? 0,
	};
	if (shape.layer?.parentId !== undefined) {
		group.parentId = shape.layer.parentId;
	}
	return group;
};
