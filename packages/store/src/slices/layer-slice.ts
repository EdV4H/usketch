import type {
	GroupShape,
	LayerMetadata,
	LayerTreeNode,
	Shape,
	ShapeGroup,
} from "@usketch/shared-types";
import { DEFAULT_LAYER_METADATA, groupShapeToShapeGroup } from "@usketch/shared-types";
import type { StateCreator } from "zustand";
import { GroupShapesCommand, ReorderCommand, UngroupShapesCommand } from "../commands/layer";
import type { WhiteboardStore } from "../store";

export interface LayerState {
	/** Z-index順の配列（形状IDまたはグループID） */
	zOrder: string[];

	/** レイヤーパネルの開閉状態 */
	layerPanelOpen: boolean;

	/** 現在選択中のレイヤー（プロパティ表示用） */
	selectedLayerId: string | null;
}

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

	/** zOrderから指定IDを削除 */
	removeFromZOrder: (id: string) => void;

	// レイヤーパネル
	/** レイヤーパネルの開閉を切り替え */
	toggleLayerPanel: () => void;

	/** レイヤー選択 */
	selectLayer: (id: string) => void;

	/** 選択レイヤーを設定（null可能） */
	setSelectedLayerId: (id: string | null) => void;

	// ユーティリティ
	/** レイヤーツリーを取得（UI表示用） */
	getLayerTree: () => LayerTreeNode[];

	/** 形状のレイヤー名を取得（自動生成含む） */
	getLayerName: (shapeId: string) => string;

	/**
	 * GroupShapeをShapeGroupに変換して取得
	 * 後方互換性のためのヘルパー関数
	 */
	getGroups: () => Record<string, ShapeGroup>;
}

export type LayerSlice = LayerState & LayerActions;

/**
 * レイヤー管理スライスの作成
 */
export const createLayerSlice: StateCreator<WhiteboardStore, [], [], LayerSlice> = (set, get) => ({
	// Initial state
	zOrder: [],
	layerPanelOpen: false,
	selectedLayerId: null,

	// グループ操作
	groupShapes: (name?: string) => {
		const state = get();
		const selectedIds = Array.from(state.selectedShapeIds);

		if (selectedIds.length < 2) {
			return null; // Need at least 2 shapes to group
		}

		// Count existing groups from shapes
		const existingGroupCount = Object.values(state.shapes).filter(
			(shape) => shape.type === "group",
		).length;
		const groupName = name || `Group ${existingGroupCount + 1}`;
		const command = new GroupShapesCommand(selectedIds, groupName);

		// Execute command with history
		state.executeCommand(command);

		// Return the groupId from the command
		return command.getGroupId();
	},

	ungroupShapes: (groupId: string) => {
		const state = get();
		const command = new UngroupShapesCommand(groupId);
		state.executeCommand(command);
	},

	addToGroup: (groupId: string, shapeIds: string[]) => {
		const state = get();
		const groupShape = state.shapes[groupId];

		if (!groupShape || groupShape.type !== "group") return;

		const updatedGroupShape = {
			...groupShape,
			childIds: [...groupShape.childIds, ...shapeIds],
		} as GroupShape;

		const updatedShapes = { ...state.shapes };
		updatedShapes[groupId] = updatedGroupShape;

		shapeIds.forEach((id) => {
			const shape = updatedShapes[id];
			if (shape) {
				updatedShapes[id] = {
					...shape,
					layer: {
						...(shape.layer || DEFAULT_LAYER_METADATA),
						parentId: groupId,
					},
				} as Shape;
			}
		});

		set({ shapes: updatedShapes });
	},

	removeFromGroup: (groupId: string, shapeIds: string[]) => {
		const state = get();
		const groupShape = state.shapes[groupId];

		if (!groupShape || groupShape.type !== "group") return;

		const updatedGroupShape = {
			...groupShape,
			childIds: groupShape.childIds.filter((id) => !shapeIds.includes(id)),
		} as GroupShape;

		const updatedShapes = { ...state.shapes };
		updatedShapes[groupId] = updatedGroupShape;

		shapeIds.forEach((id) => {
			const shape = updatedShapes[id];
			if (shape?.layer) {
				const { parentId: _, ...restLayer } = shape.layer;
				updatedShapes[id] = {
					...shape,
					layer: restLayer,
				} as Shape;
			}
		});

		set({ shapes: updatedShapes });
	},

	renameGroup: (groupId: string, name: string) => {
		const state = get();
		const groupShape = state.shapes[groupId];

		if (!groupShape || groupShape.type !== "group") return;

		const updatedGroupShape = {
			...groupShape,
			name,
		} as GroupShape;

		set({
			shapes: {
				...state.shapes,
				[groupId]: updatedGroupShape,
			},
		});
	},

	// レイヤー可視性
	toggleShapeVisibility: (shapeId: string) => {
		const state = get();
		const shape = state.shapes[shapeId];

		if (!shape) return;

		const updatedShape = {
			...shape,
			layer: {
				...(shape.layer || DEFAULT_LAYER_METADATA),
				visible: !(shape.layer?.visible ?? true),
			},
		} as Shape;

		set({
			shapes: { ...state.shapes, [shapeId]: updatedShape },
		});
	},

	toggleGroupVisibility: (groupId: string) => {
		const state = get();
		const groupShape = state.shapes[groupId];

		if (!groupShape || groupShape.type !== "group") return;

		const updatedGroupShape = {
			...groupShape,
			layer: {
				...(groupShape.layer || DEFAULT_LAYER_METADATA),
				visible: !(groupShape.layer?.visible ?? true),
			},
		} as Shape;

		set({
			shapes: { ...state.shapes, [groupId]: updatedGroupShape },
		});
	},

	// レイヤーロック
	toggleShapeLock: (shapeId: string) => {
		const state = get();
		const shape = state.shapes[shapeId];

		if (!shape) return;

		const updatedShape = {
			...shape,
			layer: {
				...(shape.layer || DEFAULT_LAYER_METADATA),
				locked: !(shape.layer?.locked ?? false),
			},
		} as Shape;

		set({
			shapes: { ...state.shapes, [shapeId]: updatedShape },
		});
	},

	toggleGroupLock: (groupId: string) => {
		const state = get();
		const groupShape = state.shapes[groupId];

		if (!groupShape || groupShape.type !== "group") return;

		const updatedGroupShape = {
			...groupShape,
			layer: {
				...(groupShape.layer || DEFAULT_LAYER_METADATA),
				locked: !(groupShape.layer?.locked ?? false),
			},
		} as Shape;

		set({
			shapes: { ...state.shapes, [groupId]: updatedGroupShape },
		});
	},

	// Z-index操作
	bringToFront: (id: string) => {
		const state = get();
		const newZOrder = state.zOrder.filter((orderId) => orderId !== id);
		newZOrder.push(id);

		set({ zOrder: newZOrder });
	},

	sendToBack: (id: string) => {
		const state = get();
		const newZOrder = state.zOrder.filter((orderId) => orderId !== id);
		newZOrder.unshift(id);

		set({ zOrder: newZOrder });
	},

	bringForward: (id: string) => {
		const state = get();
		const currentIndex = state.zOrder.indexOf(id);

		if (currentIndex === -1 || currentIndex === state.zOrder.length - 1) return;

		const newZOrder = [...state.zOrder];
		const temp = newZOrder[currentIndex];
		const nextItem = newZOrder[currentIndex + 1];
		if (temp !== undefined && nextItem !== undefined) {
			newZOrder[currentIndex] = nextItem;
			newZOrder[currentIndex + 1] = temp;
		}

		set({ zOrder: newZOrder });
	},

	sendBackward: (id: string) => {
		const state = get();
		const currentIndex = state.zOrder.indexOf(id);

		if (currentIndex <= 0) return;

		const newZOrder = [...state.zOrder];
		const temp = newZOrder[currentIndex];
		const prevItem = newZOrder[currentIndex - 1];
		if (temp !== undefined && prevItem !== undefined) {
			newZOrder[currentIndex] = prevItem;
			newZOrder[currentIndex - 1] = temp;
		}

		set({ zOrder: newZOrder });
	},

	reorderLayers: (newOrder: string[]) => {
		const state = get();
		const command = new ReorderCommand(newOrder);
		state.executeCommand(command);
	},

	removeFromZOrder: (id: string) => {
		set((state) => ({
			zOrder: state.zOrder.filter((zId) => zId !== id),
		}));
	},

	// レイヤーパネル
	toggleLayerPanel: () => {
		set((state) => ({ layerPanelOpen: !state.layerPanelOpen }));
	},

	selectLayer: (id: string) => {
		set({ selectedLayerId: id });
	},

	setSelectedLayerId: (id: string | null) => {
		set({ selectedLayerId: id });
	},

	// ユーティリティ
	getLayerTree: () => {
		const state = get();
		const tree: LayerTreeNode[] = [];
		const groups = get().getGroups();

		// Build tree in zOrder (back to front)
		for (const id of state.zOrder) {
			const shape = state.shapes[id];
			if (!shape) continue;

			// Check if it's a GroupShape
			if (shape.type === "group") {
				const group = groups[id];
				if (group) {
					tree.push({ type: "group", group });
				}
			} else {
				// It's a regular shape
				const metadata: LayerMetadata = shape.layer || DEFAULT_LAYER_METADATA;
				tree.push({ type: "shape", shape, metadata });
			}
		}

		return tree;
	},

	getLayerName: (shapeId: string) => {
		const state = get();
		const shape = state.shapes[shapeId];

		if (!shape) return "";

		// Use custom name if set
		if (shape.layer?.name) {
			return shape.layer.name;
		}

		// Auto-generate from shape type
		const typeNames: Record<string, string> = {
			rectangle: "Rectangle",
			ellipse: "Ellipse",
			line: "Line",
			text: "Text",
			freedraw: "Freedraw",
			group: "Group",
		};

		return typeNames[shape.type] || shape.type;
	},

	getGroups: () => {
		const state = get();
		const groups: Record<string, ShapeGroup> = {};

		// Convert all GroupShape instances to ShapeGroup format
		Object.values(state.shapes).forEach((shape) => {
			if (shape.type === "group") {
				const groupShape = shape as GroupShape;
				groups[groupShape.id] = groupShapeToShapeGroup(groupShape);
			}
		});

		return groups;
	},
});
