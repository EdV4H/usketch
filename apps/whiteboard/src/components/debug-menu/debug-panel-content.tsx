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

	// Phase 7 レイヤー管理デモ
	const handleLayerDemo = () => {
		const store = whiteboardStore.getState();

		console.log("🚀 Phase 7 レイヤー管理デモ開始");

		// 既存の図形をクリア
		const existingIds = Object.keys(shapes);
		if (existingIds.length > 0) {
			store.deleteShapes(existingIds);
		}

		// 3つの図形を作成
		console.log("\n📦 ステップ1: 図形を作成");
		const redBox = {
			id: "red-box",
			type: "rectangle" as const,
			x: 100,
			y: 100,
			width: 120,
			height: 120,
			rotation: 0,
			opacity: 1,
			strokeColor: "#ff0000",
			fillColor: "#ffcccc",
			strokeWidth: 3,
		};

		const greenBox = {
			id: "green-box",
			type: "rectangle" as const,
			x: 250,
			y: 100,
			width: 120,
			height: 120,
			rotation: 0,
			opacity: 1,
			strokeColor: "#00ff00",
			fillColor: "#ccffcc",
			strokeWidth: 3,
		};

		const blueBox = {
			id: "blue-box",
			type: "rectangle" as const,
			x: 400,
			y: 100,
			width: 120,
			height: 120,
			rotation: 0,
			opacity: 1,
			strokeColor: "#0000ff",
			fillColor: "#ccccff",
			strokeWidth: 3,
		};

		store.addShape(redBox);
		store.addShape(greenBox);
		store.addShape(blueBox);
		console.log("✅ 赤、緑、青の四角を作成しました");

		// グループ化デモ
		setTimeout(() => {
			console.log("\n📁 ステップ2: グループ化");
			store.setSelection(["red-box", "green-box"]);
			const groupId = store.groupShapes("左側グループ");
			console.log("✅ グループID:", groupId);
			console.log("グループ情報:", store.groups);

			// Undo/Redo
			setTimeout(() => {
				console.log("\n⏪ ステップ3: Undo");
				store.undo();
				console.log("✅ グループ解除:", store.groups);

				setTimeout(() => {
					console.log("\n⏩ ステップ4: Redo");
					store.redo();
					console.log("✅ グループ復元:", store.groups);

					// 可視性
					setTimeout(() => {
						console.log("\n👁️ ステップ5: 可視性切り替え");
						store.toggleShapeVisibility("blue-box");
						console.log("✅ 青い四角を非表示にしました");

						setTimeout(() => {
							store.toggleShapeVisibility("blue-box");
							console.log("✅ 青い四角を再表示しました");

							// Z-index操作
							setTimeout(() => {
								console.log("\n📊 ステップ6: Z-index操作");
								console.log("初期Z-order:", store.zOrder);

								store.bringToFront("red-box");
								console.log("✅ 赤を最前面:", store.zOrder);

								store.sendToBack("blue-box");
								console.log("✅ 青を最背面:", store.zOrder);

								// 最終状態
								setTimeout(() => {
									console.log("\n📋 ステップ7: 最終状態");
									const tree = store.getLayerTree();
									console.log("レイヤーツリー:", tree);

									console.log("\n✨ デモ完了！");
									console.log("ストアの全状態:", {
										shapes: store.shapes,
										groups: store.groups,
										zOrder: store.zOrder,
										canUndo: store.canUndo,
										canRedo: store.canRedo,
									});
								}, 1000);
							}, 1000);
						}, 2000);
					}, 1000);
				}, 1000);
			}, 1000);
		}, 500);
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
				<div className="debug-menu-section-title">Phase 7 Layer Management</div>
				<button type="button" className="debug-menu-item" onClick={handleLayerDemo}>
					🎬 Run Layer Demo
				</button>
				<div className="debug-info">
					<small>
						実行すると図形作成→グループ化→Undo/Redo→可視性→Z-indexの順に自動デモが行われます。
						<br />
						コンソールで詳細ログを確認してください。
					</small>
				</div>
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
