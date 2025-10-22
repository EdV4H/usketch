// Phase 7.1 & 7.2 レイヤー管理機能デモ
// ブラウザコンソールで実行してください

console.log("🚀 Phase 7 レイヤー管理デモ開始");

// 1. 図形を3つ作成
console.log("\n📦 ステップ1: 図形を作成");
window.whiteboardStore.getState().addShape({
	id: "red-box",
	type: "rectangle",
	x: 100,
	y: 100,
	width: 120,
	height: 120,
	rotation: 0,
	opacity: 1,
	strokeColor: "#ff0000",
	fillColor: "#ffcccc",
	strokeWidth: 3,
});

window.whiteboardStore.getState().addShape({
	id: "green-box",
	type: "rectangle",
	x: 250,
	y: 100,
	width: 120,
	height: 120,
	rotation: 0,
	opacity: 1,
	strokeColor: "#00ff00",
	fillColor: "#ccffcc",
	strokeWidth: 3,
});

window.whiteboardStore.getState().addShape({
	id: "blue-box",
	type: "rectangle",
	x: 400,
	y: 100,
	width: 120,
	height: 120,
	rotation: 0,
	opacity: 1,
	strokeColor: "#0000ff",
	fillColor: "#ccccff",
	strokeWidth: 3,
});

console.log("✅ 赤、緑、青の四角を作成しました");

// 2. グループ化
setTimeout(() => {
	console.log("\n📁 ステップ2: グループ化");
	window.whiteboardStore.getState().setSelection(["red-box", "green-box"]);
	const groupId = window.whiteboardStore.getState().groupShapes("左側グループ");
	console.log("✅ グループID:", groupId);
	console.log("グループ情報:", window.whiteboardStore.getState().groups);

	// 3. Undo/Redo
	setTimeout(() => {
		console.log("\n⏪ ステップ3: Undo");
		window.whiteboardStore.getState().undo();
		console.log("✅ グループ解除:", window.whiteboardStore.getState().groups);

		setTimeout(() => {
			console.log("\n⏩ ステップ4: Redo");
			window.whiteboardStore.getState().redo();
			console.log("✅ グループ復元:", window.whiteboardStore.getState().groups);

			// 4. 可視性
			setTimeout(() => {
				console.log("\n👁️ ステップ5: 可視性切り替え");
				window.whiteboardStore.getState().toggleShapeVisibility("blue-box");
				console.log("✅ 青い四角を非表示にしました");

				setTimeout(() => {
					window.whiteboardStore.getState().toggleShapeVisibility("blue-box");
					console.log("✅ 青い四角を再表示しました");

					// 5. Z-index操作
					setTimeout(() => {
						console.log("\n📊 ステップ6: Z-index操作");
						console.log("初期Z-order:", window.whiteboardStore.getState().zOrder);

						window.whiteboardStore.getState().bringToFront("red-box");
						console.log("✅ 赤を最前面:", window.whiteboardStore.getState().zOrder);

						window.whiteboardStore.getState().sendToBack("blue-box");
						console.log("✅ 青を最背面:", window.whiteboardStore.getState().zOrder);

						// 6. 最終状態
						setTimeout(() => {
							console.log("\n📋 ステップ7: 最終状態");
							const tree = window.whiteboardStore.getState().getLayerTree();
							console.log("レイヤーツリー:", tree);

							console.log("\n✨ デモ完了！");
							console.log("ストアの全状態:", {
								shapes: window.whiteboardStore.getState().shapes,
								groups: window.whiteboardStore.getState().groups,
								zOrder: window.whiteboardStore.getState().zOrder,
								canUndo: window.whiteboardStore.getState().canUndo,
								canRedo: window.whiteboardStore.getState().canRedo,
							});
						}, 1000);
					}, 1000);
				}, 2000);
			}, 1000);
		}, 1000);
	}, 1000);
}, 500);
