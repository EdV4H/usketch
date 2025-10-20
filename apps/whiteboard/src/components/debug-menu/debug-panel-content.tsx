import { whiteboardStore } from "@usketch/store";
import type React from "react";
import { useState } from "react";
import { useStore } from "../../hooks/use-store";
import { type DebugShapeType, generateDebugShapes } from "../../utils/debug-shapes";
import "./debug-panel-content.css";

/**
 * Debug Panel Content
 *
 * Provides debug tools for shape generation and testing.
 * This is the pure content component without positioning/layout concerns.
 */
export const DebugPanelContent: React.FC = () => {
	const [showHistoryPanel, setShowHistoryPanel] = useState(false);
	const addShape = useStore((state) => state.addShape);
	const shapes = useStore((state) => state.shapes);

	const handleGenerateShapes = (type: DebugShapeType) => {
		const newShapes = generateDebugShapes(type);
		for (const shape of newShapes) {
			addShape(shape);
		}
	};

	const handleClearShapes = () => {
		const store = whiteboardStore.getState();
		// すべてのシェイプを削除
		const shapeIds = Object.keys(shapes);
		store.deleteShapes(shapeIds);
		store.clearSelection();
	};

	return (
		<div className="debug-panel-content">
			<div className="debug-menu-title">Debug Tools</div>

			<div className="debug-menu-section">
				<div className="debug-menu-section-title">Generate Shapes</div>
				<button
					type="button"
					className="debug-menu-item"
					onClick={() => handleGenerateShapes("equalSpacing")}
				>
					📏 Equal Spacing (5 rectangles)
				</button>
				<button
					type="button"
					className="debug-menu-item"
					onClick={() => handleGenerateShapes("grid")}
				>
					⊞ Grid Layout (3x3)
				</button>
				<button
					type="button"
					className="debug-menu-item"
					onClick={() => handleGenerateShapes("overlapping")}
				>
					🔄 Overlapping Shapes
				</button>
				<button
					type="button"
					className="debug-menu-item"
					onClick={() => handleGenerateShapes("variety")}
				>
					🎨 Variety Pack
				</button>
			</div>

			<div className="debug-menu-section">
				<div className="debug-menu-section-title">Debug Panels</div>
				<button
					type="button"
					className="debug-menu-item"
					onClick={() => {
						setShowHistoryPanel(true);
					}}
				>
					🔍 History Debug Panel
				</button>
			</div>

			<div className="debug-menu-section">
				<div className="debug-menu-section-title">Actions</div>
				<button type="button" className="debug-menu-item danger" onClick={handleClearShapes}>
					🗑️ Clear All Shapes
				</button>
				<div className="shape-count">Current shapes: {Object.keys(shapes).length}</div>
			</div>

			{/* Note: HistoryDebugPanel will be shown via separate tab */}
			{showHistoryPanel && (
				<div className="debug-panel-notice">
					<p>History panel is now available in the "History" tab</p>
					<button type="button" onClick={() => setShowHistoryPanel(false)}>
						OK
					</button>
				</div>
			)}
		</div>
	);
};
