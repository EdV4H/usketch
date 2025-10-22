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

	// Phase 7.4 ドラッグ&ドロップデモ
	const handleDragDropDemo = () => {
		const store = whiteboardStore.getState();

		console.log("🚀 Phase 7.4 ドラッグ&ドロップデモ開始");

		// 既存の図形をクリア
		const existingIds = Object.keys(shapes);
		if (existingIds.length > 0) {
			store.deleteShapes(existingIds);
		}

		// 5つの図形を作成（異なる色、わかりやすいID）
		console.log("\n📦 ステップ1: 5つの図形を作成");
		const redRect = {
			id: "red-rectangle",
			type: "rectangle" as const,
			x: 100,
			y: 100,
			width: 100,
			height: 100,
			rotation: 0,
			opacity: 1,
			strokeColor: "#ff0000",
			fillColor: "#ffcccc",
			strokeWidth: 2,
		};

		const greenRect = {
			id: "green-rectangle",
			type: "rectangle" as const,
			x: 250,
			y: 100,
			width: 100,
			height: 100,
			rotation: 0,
			opacity: 1,
			strokeColor: "#00ff00",
			fillColor: "#ccffcc",
			strokeWidth: 2,
		};

		const blueCircle = {
			id: "blue-circle",
			type: "ellipse" as const,
			x: 400,
			y: 100,
			width: 100,
			height: 100,
			rotation: 0,
			opacity: 1,
			strokeColor: "#0000ff",
			fillColor: "#ccccff",
			strokeWidth: 2,
		};

		const purpleRect = {
			id: "purple-rectangle",
			type: "rectangle" as const,
			x: 100,
			y: 250,
			width: 100,
			height: 100,
			rotation: 0,
			opacity: 1,
			strokeColor: "#ff00ff",
			fillColor: "#ffccff",
			strokeWidth: 2,
		};

		const yellowCircle = {
			id: "yellow-circle",
			type: "ellipse" as const,
			x: 250,
			y: 250,
			width: 100,
			height: 100,
			rotation: 0,
			opacity: 1,
			strokeColor: "#ffff00",
			fillColor: "#ffffcc",
			strokeWidth: 2,
		};

		store.addShape(redRect);
		store.addShape(greenRect);
		store.addShape(blueCircle);
		store.addShape(purpleRect);
		store.addShape(yellowCircle);
		console.log(
			"✅ 5つの図形を作成しました（red-rectangle, green-rectangle, blue-circle, purple-rectangle, yellow-circle）",
		);

		// グループ作成
		setTimeout(() => {
			console.log("\n📁 ステップ2: グループを作成");
			store.setSelection(["red-rectangle", "green-rectangle"]);
			const group1Id = store.groupShapes("Group A");
			console.log("✅ Group A を作成:", group1Id);

			setTimeout(() => {
				store.setSelection(["purple-rectangle", "yellow-circle"]);
				const group2Id = store.groupShapes("Group B");
				console.log("✅ Group B を作成:", group2Id);

				console.log("\n🎯 テスト手順:");
				console.log("1. レイヤーパネルを開く（右上の Layers ボタン）");
				console.log("2. レイヤーをドラッグして並び替えてみる");
				console.log("3. blue-circle を Group A にドラッグ&ドロップ");
				console.log("4. グループ内の図形を別のグループにドラッグ");
				console.log("5. ドラッグ中の視覚的フィードバックを確認");
				console.log("\n✨ ドラッグ&ドロップデモセットアップ完了！");
			}, 500);
		}, 500);
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
			// グループ化後に最新のストア状態を取得
			const updatedStore = whiteboardStore.getState();
			console.log("グループ情報:", updatedStore.getGroups());
			console.log("Z-order:", updatedStore.zOrder);

			// Undo/Redo
			setTimeout(() => {
				console.log("\n⏪ ステップ3: Undo");
				store.undo();
				const afterUndo = whiteboardStore.getState();
				console.log("✅ グループ解除:", afterUndo.getGroups());
				console.log("Z-order:", afterUndo.zOrder);

				setTimeout(() => {
					console.log("\n⏩ ステップ4: Redo");
					store.redo();
					const afterRedo = whiteboardStore.getState();
					console.log("✅ グループ復元:", afterRedo.getGroups());
					console.log("Z-order:", afterRedo.zOrder);

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
								const beforeZ = whiteboardStore.getState();
								console.log("初期Z-order:", beforeZ.zOrder);

								store.bringToFront("red-box");
								const afterFront = whiteboardStore.getState();
								console.log("✅ 赤を最前面:", afterFront.zOrder);

								store.sendToBack("blue-box");
								const afterBack = whiteboardStore.getState();
								console.log("✅ 青を最背面:", afterBack.zOrder);

								// 最終状態
								setTimeout(() => {
									console.log("\n📋 ステップ7: 最終状態");
									const finalState = whiteboardStore.getState();
									const tree = finalState.getLayerTree();
									console.log("レイヤーツリー:", tree);

									console.log("\n✨ デモ完了！");
									console.log("ストアの全状態:", {
										shapes: finalState.shapes,
										groups: finalState.getGroups(),
										zOrder: finalState.zOrder,
										canUndo: finalState.canUndo,
										canRedo: finalState.canRedo,
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
				<div className="debug-menu-section-title">Phase 7.4 Drag & Drop</div>
				<button type="button" className="debug-menu-item" onClick={handleDragDropDemo}>
					🖱️ Run Drag & Drop Demo
				</button>
				<div className="debug-info">
					<small>
						5つの図形と2つのグループを作成します。
						<br />
						レイヤーパネルで図形をドラッグ&ドロップして並び替えやグループ追加を試してください。
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
