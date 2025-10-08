import type { LayerMetadata, LayerTreeNode, Shape, ShapeGroup } from "@usketch/shared-types";
import { createDefaultGroup, DEFAULT_LAYER_METADATA } from "@usketch/shared-types";
import { nanoid } from "nanoid";
import type { StateCreator } from "zustand";
import { GroupShapesCommand, ReorderCommand, UngroupShapesCommand } from "../commands/layer";
import type { StoreState } from "../store";

/**
 * レイヤー管理の状態
 */
export interface LayerState {
	/** グループ情報のマップ */
	groups?: Record<string, ShapeGroup>;

	/** Z-index順の配列（形状IDまたはグループID） */
	zOrder?: string[];

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

	// Actions
	groupShapes: (name?: string) => {
		const { selectedShapeIds, shapes, executeCommand, groups } = get();
		if (selectedShapeIds.size < 2) return null;

		const shapeIds = Array.from(selectedShapeIds);
		const groupId = nanoid();

		// グループ数を数えて名前を決定
		const groupCount = groups ? Object.keys(groups).length : 0;
		const groupName = name || `グループ ${groupCount + 1}`;

		// 選択中の形状の最大zIndexを取得
		const maxZIndex = Math.max(
			...shapeIds.map((id) => {
				const shape = shapes[id];
				return shape?.layer?.zIndex ?? 0;
			}),
		);

		// グループを作成
		const group: ShapeGroup = {
			...createDefaultGroup(groupName),
			id: groupId,
			childIds: [...shapeIds],
			zIndex: maxZIndex,
		};

		const command = new GroupShapesCommand(shapeIds, group);
		executeCommand(command);

		return groupId;
	},

	ungroupShapes: (groupId: string) => {
		const { groups, executeCommand } = get();
		if (!groups) return;
		const group = groups[groupId];
		if (!group) return;

		const command = new UngroupShapesCommand(groupId, group.childIds);
		executeCommand(command);
	},

	addToGroup: (groupId: string, shapeIds: string[]) => {
		// TODO: Phase 7.2で実装
		throw new Error(
			`addToGroup not yet implemented: groupId=${groupId}, shapeIds=${JSON.stringify(shapeIds)}`,
		);
	},

	removeFromGroup: (groupId: string, shapeIds: string[]) => {
		// TODO: Phase 7.2で実装
		throw new Error(
			`removeFromGroup not yet implemented: groupId=${groupId}, shapeIds=${JSON.stringify(shapeIds)}`,
		);
	},

	renameGroup: (groupId: string, name: string) => {
		set((state) => {
			if (!state.groups) return state;
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
			if (!state.groups) return state;
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
			if (!state.groups) return state;
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
		const { zOrder, executeCommand } = get();
		if (!zOrder) return;
		const currentIndex = zOrder.indexOf(id);
		if (currentIndex === -1 || currentIndex === zOrder.length - 1) return;

		const newIndex = zOrder.length - 1;
		const command = new ReorderCommand(id, currentIndex, newIndex);
		executeCommand(command);
	},

	sendToBack: (id: string) => {
		const { zOrder, executeCommand } = get();
		if (!zOrder) return;
		const currentIndex = zOrder.indexOf(id);
		if (currentIndex === -1 || currentIndex === 0) return;

		const newIndex = 0;
		const command = new ReorderCommand(id, currentIndex, newIndex);
		executeCommand(command);
	},

	bringForward: (id: string) => {
		const { zOrder, executeCommand } = get();
		if (!zOrder) return;
		const currentIndex = zOrder.indexOf(id);
		if (currentIndex === -1 || currentIndex === zOrder.length - 1) return;

		const newIndex = currentIndex + 1;
		const command = new ReorderCommand(id, currentIndex, newIndex);
		executeCommand(command);
	},

	sendBackward: (id: string) => {
		const { zOrder, executeCommand } = get();
		if (!zOrder) return;
		const currentIndex = zOrder.indexOf(id);
		if (currentIndex === -1 || currentIndex === 0) return;

		const newIndex = currentIndex - 1;
		const command = new ReorderCommand(id, currentIndex, newIndex);
		executeCommand(command);
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

		if (!zOrder || !groups) return tree;

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
