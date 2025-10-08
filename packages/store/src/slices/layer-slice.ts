import type { LayerMetadata, LayerTreeNode, Shape, ShapeGroup } from "@usketch/shared-types";
import { DEFAULT_LAYER_METADATA } from "@usketch/shared-types";
import type { StateCreator } from "zustand";
import type { StoreState } from "../store";

/**
 * レイヤー管理の状態
 */
export interface LayerState {
	/** グループ情報のマップ */
	groups: Record<string, ShapeGroup>;

	/** Z-index順の配列（形状IDまたはグループID） */
	zOrder: string[];

	/** レイヤーパネルの開閉状態 */
	layerPanelOpen: boolean;

	/** 現在選択中のレイヤー（プロパティ表示用） */
	selectedLayerId: string | null;
}

/**
 * レイヤー管理のアクション
 */
export interface LayerActions {
	// グループ操作
	/** 選択中の形状をグループ化 */
	groupShapes: (name?: string) => string | null;

	/** グループを解除 */
	ungroupShapes: (groupId: string) => void;

	/** グループに形状を追加 */
	addToGroup: (groupId: string, shapeIds: string[]) => void;

	/** グループから形状を削除 */
	removeFromGroup: (groupId: string, shapeIds: string[]) => void;

	/** グループ名を変更 */
	renameGroup: (groupId: string, name: string) => void;

	// レイヤー可視性
	/** 形状の可視性を切り替え */
	toggleShapeVisibility: (shapeId: string) => void;

	/** グループの可視性を切り替え */
	toggleGroupVisibility: (groupId: string) => void;

	// レイヤーロック
	/** 形状のロック状態を切り替え */
	toggleShapeLock: (shapeId: string) => void;

	/** グループのロック状態を切り替え */
	toggleGroupLock: (groupId: string) => void;

	// Z-index操作
	/** 形状を最前面に移動 */
	bringToFront: (id: string) => void;

	/** 形状を最背面に移動 */
	sendToBack: (id: string) => void;

	/** 形状を1つ前面に移動 */
	bringForward: (id: string) => void;

	/** 形状を1つ背面に移動 */
	sendBackward: (id: string) => void;

	/** Z-index順を直接設定（ドラッグ&ドロップ用） */
	reorderLayers: (newOrder: string[]) => void;

	// レイヤーパネル
	/** レイヤーパネルの開閉を切り替え */
	toggleLayerPanel: () => void;

	/** レイヤー選択 */
	selectLayer: (id: string) => void;

	// ユーティリティ
	/** レイヤーツリーを取得（UI表示用） */
	getLayerTree: () => LayerTreeNode[];

	/** 形状のレイヤー名を取得（自動生成含む） */
	getLayerName: (shapeId: string) => string;
}

export type LayerSlice = LayerState & LayerActions;

/**
 * レイヤースライスの作成
 */
export const createLayerSlice: StateCreator<StoreState, [], [], LayerSlice> = (set, get) => ({
	// Initial state
	groups: {},
	zOrder: [],
	layerPanelOpen: false,
	selectedLayerId: null,

	// Actions (スタブ実装 - Phase 7.2で実装)
	groupShapes: (name?: string) => {
		// TODO: Phase 7.2で実装
		console.warn("groupShapes not yet implemented", name);
		return null;
	},

	ungroupShapes: (groupId: string) => {
		// TODO: Phase 7.2で実装
		console.warn("ungroupShapes not yet implemented", groupId);
	},

	addToGroup: (groupId: string, shapeIds: string[]) => {
		// TODO: Phase 7.2で実装
		console.warn("addToGroup not yet implemented", groupId, shapeIds);
	},

	removeFromGroup: (groupId: string, shapeIds: string[]) => {
		// TODO: Phase 7.2で実装
		console.warn("removeFromGroup not yet implemented", groupId, shapeIds);
	},

	renameGroup: (groupId: string, name: string) => {
		set((state) => {
			const group = state.groups[groupId];
			if (!group) return state;

			return {
				groups: {
					...state.groups,
					[groupId]: { ...group, name },
				},
			};
		});
	},

	toggleShapeVisibility: (shapeId: string) => {
		set((state) => {
			const shape = state.shapes[shapeId];
			if (!shape) return state;

			const currentLayer = shape.layer || DEFAULT_LAYER_METADATA;
			return {
				shapes: {
					...state.shapes,
					[shapeId]: {
						...shape,
						layer: {
							...currentLayer,
							visible: !currentLayer.visible,
						},
					},
				},
			};
		});
	},

	toggleGroupVisibility: (groupId: string) => {
		set((state) => {
			const group = state.groups[groupId];
			if (!group) return state;

			const newVisible = !group.visible;
			const updatedShapes = { ...state.shapes };

			// グループ内の全形状の可視性も更新
			group.childIds.forEach((id) => {
				const shape = updatedShapes[id];
				if (shape) {
					const currentLayer = shape.layer || DEFAULT_LAYER_METADATA;
					updatedShapes[id] = {
						...shape,
						layer: {
							...currentLayer,
							visible: newVisible,
						},
					};
				}
			});

			return {
				groups: {
					...state.groups,
					[groupId]: { ...group, visible: newVisible },
				},
				shapes: updatedShapes,
			};
		});
	},

	toggleShapeLock: (shapeId: string) => {
		set((state) => {
			const shape = state.shapes[shapeId];
			if (!shape) return state;

			const currentLayer = shape.layer || DEFAULT_LAYER_METADATA;
			return {
				shapes: {
					...state.shapes,
					[shapeId]: {
						...shape,
						layer: {
							...currentLayer,
							locked: !currentLayer.locked,
						},
					},
				},
			};
		});
	},

	toggleGroupLock: (groupId: string) => {
		set((state) => {
			const group = state.groups[groupId];
			if (!group) return state;

			const newLocked = !group.locked;
			const updatedShapes = { ...state.shapes };

			// グループ内の全形状のロック状態も更新
			group.childIds.forEach((id) => {
				const shape = updatedShapes[id];
				if (shape) {
					const currentLayer = shape.layer || DEFAULT_LAYER_METADATA;
					updatedShapes[id] = {
						...shape,
						layer: {
							...currentLayer,
							locked: newLocked,
						},
					};
				}
			});

			return {
				groups: {
					...state.groups,
					[groupId]: { ...group, locked: newLocked },
				},
				shapes: updatedShapes,
			};
		});
	},

	bringToFront: (id: string) => {
		// TODO: Phase 7.2で実装（コマンドパターン使用）
		console.warn("bringToFront not yet implemented", id);
	},

	sendToBack: (id: string) => {
		// TODO: Phase 7.2で実装（コマンドパターン使用）
		console.warn("sendToBack not yet implemented", id);
	},

	bringForward: (id: string) => {
		// TODO: Phase 7.2で実装（コマンドパターン使用）
		console.warn("bringForward not yet implemented", id);
	},

	sendBackward: (id: string) => {
		// TODO: Phase 7.2で実装（コマンドパターン使用）
		console.warn("sendBackward not yet implemented", id);
	},

	reorderLayers: (newOrder: string[]) => {
		set((state) => {
			const updatedShapes = { ...state.shapes };
			const updatedGroups = { ...state.groups };

			// zIndexを更新
			newOrder.forEach((id, index) => {
				if (updatedShapes[id]) {
					const currentLayer = updatedShapes[id].layer || DEFAULT_LAYER_METADATA;
					updatedShapes[id] = {
						...updatedShapes[id],
						layer: { ...currentLayer, zIndex: index },
					};
				} else if (updatedGroups[id]) {
					updatedGroups[id] = { ...updatedGroups[id], zIndex: index };
				}
			});

			return {
				zOrder: newOrder,
				shapes: updatedShapes,
				groups: updatedGroups,
			};
		});
	},

	toggleLayerPanel: () => {
		set((state) => ({
			layerPanelOpen: !state.layerPanelOpen,
		}));
	},

	selectLayer: (id: string) => {
		set({ selectedLayerId: id });
	},

	getLayerTree: () => {
		const { shapes, groups, zOrder } = get();
		const tree: LayerTreeNode[] = [];

		// zOrder順に処理（逆順で最前面から表示）
		[...zOrder].reverse().forEach((id) => {
			if (groups[id]) {
				tree.push({ type: "group", group: groups[id] });
			} else if (shapes[id]) {
				const shape = shapes[id];
				const metadata: LayerMetadata = shape.layer || DEFAULT_LAYER_METADATA;

				// 親グループがない場合のみトップレベルに追加
				if (!metadata.parentId) {
					tree.push({ type: "shape", shape, metadata });
				}
			}
		});

		return tree;
	},

	getLayerName: (shapeId: string) => {
		const { shapes } = get();
		const shape = shapes[shapeId];
		if (!shape) return "";

		// カスタム名が設定されている場合はそれを使用
		if (shape.layer?.name) {
			return shape.layer.name;
		}

		// 形状タイプから自動生成
		const typeNames: Record<Shape["type"], string> = {
			rectangle: "長方形",
			ellipse: "楕円",
			line: "線",
			text: "テキスト",
			freedraw: "フリーハンド",
		};

		return typeNames[shape.type] || shape.type;
	},
});
