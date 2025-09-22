import {
	DEFAULT_LAYER,
	type Layer,
	type LayerActions,
	type LayerGroup,
	type LayerState,
} from "@usketch/shared-types";
import { produce } from "immer";
import { nanoid } from "nanoid";
import type { StateCreator } from "zustand";
import type { StoreState } from "../store";

export type LayerSlice = LayerState & LayerActions;

export const createLayerSlice: StateCreator<StoreState, [], [], LayerSlice> = (set, get) => ({
	// Initial state
	layers: new Map([[DEFAULT_LAYER.id, DEFAULT_LAYER]]),
	layerOrder: [DEFAULT_LAYER.id],
	activeLayerId: DEFAULT_LAYER.id,
	layerGroups: new Map(),

	// Layer CRUD operations
	addLayer: (name) => {
		const id = nanoid();
		const currentLayers = get().layers;
		const newLayer: Layer = {
			id,
			name: name || `Layer ${currentLayers.size + 1}`,
			visible: true,
			locked: false,
			opacity: 1,
			parentId: null,
			childIds: [],
			shapeIds: [],
			collapsed: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		set((state) => {
			// Create new objects/arrays for immutability
			const newLayers = new Map(state.layers);
			newLayers.set(id, newLayer);
			const newLayerOrder = [id, ...state.layerOrder];

			return {
				...state,
				layers: newLayers,
				layerOrder: newLayerOrder,
				activeLayerId: id,
			};
		});

		return id;
	},

	deleteLayer: (layerId) => {
		const { layers } = get();

		// Can't delete the default layer
		if (layerId === DEFAULT_LAYER.id) {
			console.warn("Cannot delete the default layer");
			return;
		}

		const layer = layers.get(layerId);
		if (!layer) return;

		set((state) => {
			const newLayers = new Map(state.layers);
			const defaultLayer = newLayers.get(DEFAULT_LAYER.id);

			// Move shapes to default layer if needed
			if (defaultLayer && layer.shapeIds.length > 0) {
				defaultLayer.shapeIds.push(...layer.shapeIds);
				newLayers.set(DEFAULT_LAYER.id, { ...defaultLayer });
			}

			newLayers.delete(layerId);
			const newLayerOrder = state.layerOrder.filter((id) => id !== layerId);
			const newActiveLayerId =
				state.activeLayerId === layerId ? DEFAULT_LAYER.id : state.activeLayerId;

			return {
				...state,
				layers: newLayers,
				layerOrder: newLayerOrder,
				activeLayerId: newActiveLayerId,
			};
		});
	},

	renameLayer: (layerId, name) => {
		set((state) => {
			const layer = state.layers.get(layerId);
			if (!layer) return state;

			const newLayers = new Map(state.layers);
			newLayers.set(layerId, {
				...layer,
				name,
				updatedAt: new Date(),
			});

			return {
				...state,
				layers: newLayers,
			};
		});
	},

	duplicateLayer: (layerId) => {
		const layer = get().layers.get(layerId);
		if (!layer) return "";

		const id = nanoid();
		const duplicatedLayer: Layer = {
			...layer,
			id,
			name: `${layer.name} Copy`,
			shapeIds: [], // Don't duplicate shapes initially
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		set((state) => {
			const newLayers = new Map(state.layers);
			newLayers.set(id, duplicatedLayer);

			const newLayerOrder = [...state.layerOrder];
			const index = newLayerOrder.indexOf(layerId);
			newLayerOrder.splice(index, 0, id);

			return {
				...state,
				layers: newLayers,
				layerOrder: newLayerOrder,
				activeLayerId: id,
			};
		});

		return id;
	},

	// Layer visibility and locking
	toggleLayerVisibility: (layerId) => {
		set((state) => {
			const layer = state.layers.get(layerId);
			if (!layer) return state;

			const newLayers = new Map(state.layers);
			newLayers.set(layerId, {
				...layer,
				visible: !layer.visible,
				updatedAt: new Date(),
			});

			return {
				...state,
				layers: newLayers,
			};
		});
	},

	toggleLayerLock: (layerId) => {
		set((state) => {
			const layer = state.layers.get(layerId);
			if (!layer) return state;

			const newLayers = new Map(state.layers);
			newLayers.set(layerId, {
				...layer,
				locked: !layer.locked,
				updatedAt: new Date(),
			});

			return {
				...state,
				layers: newLayers,
			};
		});
	},

	setLayerOpacity: (layerId, opacity) => {
		set(
			produce((state) => {
				const layer = state.layers.get(layerId);
				if (layer) {
					layer.opacity = Math.max(0, Math.min(1, opacity));
					layer.updatedAt = new Date();
				}
			}),
		);
	},

	// Layer ordering
	moveLayerUp: (layerId) => {
		set(
			produce((state) => {
				const index = state.layerOrder.indexOf(layerId);
				if (index > 0) {
					[state.layerOrder[index - 1], state.layerOrder[index]] = [
						state.layerOrder[index],
						state.layerOrder[index - 1],
					];
				}
			}),
		);
	},

	moveLayerDown: (layerId) => {
		set(
			produce((state) => {
				const index = state.layerOrder.indexOf(layerId);
				if (index < state.layerOrder.length - 1 && index >= 0) {
					[state.layerOrder[index], state.layerOrder[index + 1]] = [
						state.layerOrder[index + 1],
						state.layerOrder[index],
					];
				}
			}),
		);
	},

	moveLayerToTop: (layerId) => {
		set(
			produce((state) => {
				state.layerOrder = state.layerOrder.filter((id: string) => id !== layerId);
				state.layerOrder.unshift(layerId);
			}),
		);
	},

	moveLayerToBottom: (layerId) => {
		set(
			produce((state) => {
				state.layerOrder = state.layerOrder.filter((id: string) => id !== layerId);
				state.layerOrder.push(layerId);
			}),
		);
	},

	reorderLayers: (newOrder) => {
		set((state) => ({
			...state,
			layerOrder: newOrder,
		}));
	},

	// Shape-layer association
	moveShapeToLayer: (shapeId, targetLayerId) => {
		set(
			produce((state) => {
				// Remove shape from current layer
				for (const layer of state.layers.values()) {
					const index = layer.shapeIds.indexOf(shapeId);
					if (index !== -1) {
						layer.shapeIds.splice(index, 1);
						break;
					}
				}

				// Add to target layer
				const targetLayer = state.layers.get(targetLayerId);
				if (targetLayer && !targetLayer.shapeIds.includes(shapeId)) {
					targetLayer.shapeIds.push(shapeId);
					targetLayer.updatedAt = new Date();
				}
			}),
		);
	},

	moveShapesToLayer: (shapeIds, targetLayerId) => {
		set(
			produce((state) => {
				// Remove shapes from all layers
				for (const layer of state.layers.values()) {
					layer.shapeIds = layer.shapeIds.filter((id: string) => !shapeIds.includes(id));
				}

				// Add to target layer
				const targetLayer = state.layers.get(targetLayerId);
				if (targetLayer) {
					targetLayer.shapeIds.push(...shapeIds);
					targetLayer.updatedAt = new Date();
				}
			}),
		);
	},

	// Group operations
	groupLayers: (layerIds, groupName) => {
		const groupId = nanoid();
		const newGroup: LayerGroup = {
			id: groupId,
			name: groupName || `Group ${get().layerGroups.size + 1}`,
			layerIds,
			parentGroupId: null,
			collapsed: false,
		};

		set(
			produce((state) => {
				state.layerGroups.set(groupId, newGroup);

				// Update parent references in layers
				for (const layerId of layerIds) {
					const layer = state.layers.get(layerId);
					if (layer) {
						layer.parentId = groupId;
					}
				}
			}),
		);

		return groupId;
	},

	ungroupLayers: (groupId) => {
		const group = get().layerGroups.get(groupId);
		if (!group) return;

		set(
			produce((state) => {
				// Clear parent references
				for (const layerId of group.layerIds) {
					const layer = state.layers.get(layerId);
					if (layer) {
						layer.parentId = null;
					}
				}

				state.layerGroups.delete(groupId);
			}),
		);
	},

	toggleGroupCollapse: (groupId) => {
		set(
			produce((state) => {
				const group = state.layerGroups.get(groupId);
				if (group) {
					group.collapsed = !group.collapsed;
				}
			}),
		);
	},

	// Selection
	selectLayer: (layerId) => {
		set(
			produce((state) => {
				state.activeLayerId = layerId;

				// Select all shapes in this layer
				const layer = state.layers.get(layerId);
				if (layer) {
					state.selectedShapeIds = new Set(layer.shapeIds);
				}
			}),
		);
	},

	selectMultipleLayers: (layerIds) => {
		set(
			produce((state) => {
				// Select all shapes from multiple layers
				const shapeIds = new Set<string>();
				for (const layerId of layerIds) {
					const layer = state.layers.get(layerId);
					if (layer) {
						for (const shapeId of layer.shapeIds) {
							shapeIds.add(shapeId);
						}
					}
				}
				state.selectedShapeIds = shapeIds;
			}),
		);
	},

	// Utility
	getLayerByShapeId: (shapeId) => {
		const { layers } = get();
		for (const layer of layers.values()) {
			if (layer.shapeIds.includes(shapeId)) {
				return layer;
			}
		}
		return null;
	},

	getShapesInLayer: (layerId) => {
		const layer = get().layers.get(layerId);
		return layer ? layer.shapeIds : [];
	},

	mergeLayersDown: (layerId) => {
		const { layerOrder, layers } = get();
		const index = layerOrder.indexOf(layerId);

		if (index < layerOrder.length - 1 && index >= 0) {
			const sourceLayer = layers.get(layerId);
			const targetLayerId = layerOrder[index + 1];
			const targetLayer = targetLayerId ? layers.get(targetLayerId) : undefined;

			if (sourceLayer && targetLayer) {
				set(
					produce((state) => {
						// Move all shapes to target layer
						targetLayer.shapeIds.push(...sourceLayer.shapeIds);
						targetLayer.updatedAt = new Date();

						// Delete source layer
						state.layers.delete(layerId);
						state.layerOrder = state.layerOrder.filter((id: string) => id !== layerId);

						// Update active layer
						if (state.activeLayerId === layerId) {
							state.activeLayerId = targetLayerId;
						}
					}),
				);
			}
		}
	},
});
