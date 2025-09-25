import { whiteboardStore } from "@usketch/store";
import { HistoryDebugPanel } from "@usketch/ui-components";
import type React from "react";
import { useState } from "react";
import { useStore } from "../hooks/use-store";
import { type DebugShapeType, generateDebugShapes } from "../utils/debug-shapes";

export const DebugMenu: React.FC = () => {
	const [isOpen, setIsOpen] = useState(false);
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
		<div
			style={{
				position: "fixed",
				bottom: 20,
				right: 20,
				zIndex: 1000,
			}}
		>
			<style>
				{`
					.debug-menu-button {
						background: #2D3436;
						color: white;
						border: none;
						padding: 10px 20px;
						border-radius: 8px;
						cursor: pointer;
						font-size: 14px;
						font-weight: 600;
						box-shadow: 0 2px 8px rgba(0,0,0,0.2);
						transition: all 0.2s;
					}

					.debug-menu-button:hover {
						background: #3D4446;
						transform: translateY(-1px);
						box-shadow: 0 4px 12px rgba(0,0,0,0.3);
					}

					.debug-menu-panel {
						position: absolute;
						bottom: 50px;
						right: 0;
						background: white;
						border: 1px solid #e0e0e0;
						border-radius: 12px;
						box-shadow: 0 4px 20px rgba(0,0,0,0.15);
						padding: 12px;
						min-width: 200px;
						animation: slideUp 0.2s ease-out;
					}

					@keyframes slideUp {
						from {
							opacity: 0;
							transform: translateY(10px);
						}
						to {
							opacity: 1;
							transform: translateY(0);
						}
					}

					.debug-menu-title {
						font-size: 14px;
						font-weight: 600;
						color: #333;
						margin-bottom: 12px;
						padding-bottom: 8px;
						border-bottom: 1px solid #e0e0e0;
					}

					.debug-menu-section {
						margin-bottom: 12px;
					}

					.debug-menu-section-title {
						font-size: 12px;
						font-weight: 600;
						color: #666;
						margin-bottom: 8px;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}

					.debug-menu-item {
						display: block;
						width: 100%;
						text-align: left;
						background: #f5f5f5;
						border: 1px solid #e0e0e0;
						padding: 8px 12px;
						margin-bottom: 4px;
						border-radius: 6px;
						cursor: pointer;
						font-size: 13px;
						color: #333;
						transition: all 0.15s;
					}

					.debug-menu-item:hover {
						background: #e8e8e8;
						border-color: #d0d0d0;
					}

					.debug-menu-item.danger {
						background: #ffebee;
						border-color: #ffcdd2;
						color: #c62828;
					}

					.debug-menu-item.danger:hover {
						background: #ffcdd2;
						border-color: #ef9a9a;
					}

					.shape-count {
						font-size: 11px;
						color: #999;
						margin-top: 4px;
					}
				`}
			</style>

			<button type="button" className="debug-menu-button" onClick={() => setIsOpen(!isOpen)}>
				🔧 Debug
			</button>

			{isOpen && (
				<div className="debug-menu-panel">
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
								setIsOpen(false);
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
				</div>
			)}

			{/* History Debug Panel */}
			{showHistoryPanel && <HistoryDebugPanel onClose={() => setShowHistoryPanel(false)} />}
		</div>
	);
};
