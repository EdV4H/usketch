import {
	DEFAULT_STYLE_PRESETS,
	type Shape,
	type StylePreset,
	type StyleProperties,
	type StyleState,
} from "@usketch/shared-types";
import { nanoid } from "nanoid";
import type { StateCreator } from "zustand";
import type { StoreState } from "../store";

export interface StyleActions {
	// スタイル更新
	updateSelectedShapesStyle: (styles: Partial<StyleProperties>) => void;

	// スタイルコピー/ペースト
	copyStyleFromSelection: () => void;
	pasteStyleToSelection: () => void;

	// プリセット管理
	saveStylePreset: (name: string) => void;
	applyStylePreset: (presetId: string) => void;
	deleteStylePreset: (presetId: string) => void;

	// カラー履歴
	addRecentColor: (color: string) => void;

	// 選択中形状のスタイルを更新
	updateSelectedShapeStyles: () => void;
}

export type StyleSlice = StyleState & StyleActions;

const MAX_RECENT_COLORS = 10;

export const createStyleSlice: StateCreator<StoreState, [], [], StyleSlice> = (
	set,
	get,
	_store,
) => ({
	// Initial state
	selectedShapeStyles: null,
	stylePresets: [...DEFAULT_STYLE_PRESETS],
	copiedStyle: null,
	recentColors: [],

	// Actions
	updateSelectedShapesStyle: (styles) => {
		const { selectedShapeIds, shapes, executeCommand } = get();
		if (selectedShapeIds.size === 0) return;

		// Create a command for undo/redo
		const affectedShapes = Array.from(selectedShapeIds)
			.map((id) => shapes[id])
			.filter(Boolean);

		if (affectedShapes.length === 0) return;

		// Store previous styles for undo
		const previousStyles = new Map<string, Partial<StyleProperties>>();
		affectedShapes.forEach((shape) => {
			if (shape) {
				previousStyles.set(shape.id, {
					fillColor: shape.fillColor,
					strokeColor: shape.strokeColor,
					strokeWidth: shape.strokeWidth,
					opacity: shape.opacity,
				});
			}
		});

		// Apply the style changes through a command (for undo/redo support)
		const command = {
			id: nanoid(),
			timestamp: Date.now(),
			description: "Update shape styles",
			execute: (context) => {
				// Directly update shapes without creating nested commands
				context.setState((state) => {
					const newShapes = { ...state.shapes };
					Array.from(selectedShapeIds).forEach((id) => {
						if (newShapes[id]) {
							newShapes[id] = { ...newShapes[id], ...styles } as Shape;
						}
					});
					state.shapes = newShapes;
				});
			},
			undo: (context) => {
				// Directly restore previous styles without creating nested commands
				context.setState((state) => {
					const newShapes = { ...state.shapes };
					previousStyles.forEach((prevStyle, id) => {
						if (newShapes[id]) {
							newShapes[id] = { ...newShapes[id], ...prevStyle } as Shape;
						}
					});
					state.shapes = newShapes;
				});
			},
		};

		executeCommand(command);

		// Add colors to recent colors if they exist
		if (styles.fillColor) get().addRecentColor(styles.fillColor);
		if (styles.strokeColor) get().addRecentColor(styles.strokeColor);
	},

	copyStyleFromSelection: () => {
		const { selectedShapeIds, shapes } = get();
		if (selectedShapeIds.size === 0) return;

		const firstId = Array.from(selectedShapeIds)[0];
		if (!firstId) return;
		const shape = shapes[firstId];
		if (!shape) return;

		set({
			copiedStyle: {
				fillColor: shape.fillColor,
				strokeColor: shape.strokeColor,
				strokeWidth: shape.strokeWidth,
				opacity: shape.opacity,
			},
		});
	},

	pasteStyleToSelection: () => {
		const { copiedStyle, updateSelectedShapesStyle } = get();
		if (!copiedStyle) return;

		updateSelectedShapesStyle(copiedStyle);
	},

	saveStylePreset: (name) => {
		const { selectedShapeStyles, stylePresets } = get();
		if (!selectedShapeStyles) return;

		const newPreset: StylePreset = {
			id: nanoid(),
			name,
			style: {
				fillColor: selectedShapeStyles.fillColor || "#e0e0ff",
				strokeColor: selectedShapeStyles.strokeColor || "#333333",
				strokeWidth: selectedShapeStyles.strokeWidth || 2,
				opacity: selectedShapeStyles.opacity ?? 1,
			},
			createdAt: new Date(),
		};

		set({
			stylePresets: [...stylePresets, newPreset],
		});
	},

	applyStylePreset: (presetId) => {
		const { stylePresets, updateSelectedShapesStyle } = get();
		const preset = stylePresets.find((p) => p.id === presetId);
		if (!preset) return;

		updateSelectedShapesStyle(preset.style);
	},

	deleteStylePreset: (presetId) => {
		const { stylePresets } = get();
		set({
			stylePresets: stylePresets.filter((p) => p.id !== presetId),
		});
	},

	addRecentColor: (color) => {
		const { recentColors } = get();
		const newColors = [color, ...recentColors.filter((c) => c !== color)];
		set({
			recentColors: newColors.slice(0, MAX_RECENT_COLORS),
		});
	},

	updateSelectedShapeStyles: () => {
		const { selectedShapeIds, shapes } = get();

		if (selectedShapeIds.size === 0) {
			set({ selectedShapeStyles: null });
			return;
		}

		// Get common styles from selected shapes
		const selectedShapes = Array.from(selectedShapeIds)
			.map((id) => shapes[id])
			.filter(Boolean);

		if (selectedShapes.length === 0) {
			set({ selectedShapeStyles: null });
			return;
		}

		// Find common styles among selected shapes
		const firstShape = selectedShapes[0];
		if (!firstShape) {
			set({ selectedShapeStyles: null });
			return;
		}

		const commonStyles: Partial<StyleProperties> = {
			fillColor: firstShape.fillColor,
			strokeColor: firstShape.strokeColor,
			strokeWidth: firstShape.strokeWidth,
			opacity: firstShape.opacity,
		};

		// Check if all shapes have the same values
		for (const shape of selectedShapes.slice(1)) {
			if (!shape) continue;

			if (shape.fillColor !== commonStyles.fillColor) {
				delete commonStyles.fillColor;
			}
			if (shape.strokeColor !== commonStyles.strokeColor) {
				delete commonStyles.strokeColor;
			}
			if (shape.strokeWidth !== commonStyles.strokeWidth) {
				delete commonStyles.strokeWidth;
			}
			if (shape.opacity !== commonStyles.opacity) {
				delete commonStyles.opacity;
			}
		}

		set({ selectedShapeStyles: commonStyles });
	},
});
