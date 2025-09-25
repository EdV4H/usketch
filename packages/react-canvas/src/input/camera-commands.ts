import type { CommandHandler, GestureEvent, PanEvent } from "@usketch/input-manager";
import type { Shape } from "@usketch/shared-types";
import type { WhiteboardStore } from "@usketch/store";

/**
 * シェイプのバウンディングボックスを取得
 */
function getShapeBounds(shape: Shape): { x: number; y: number; width: number; height: number } {
	switch (shape.type) {
		case "rectangle":
		case "ellipse":
		case "freedraw":
			return {
				x: shape.x,
				y: shape.y,
				width: shape.width,
				height: shape.height,
			};
		case "line":
			return {
				x: Math.min(shape.x, shape.x2),
				y: Math.min(shape.y, shape.y2),
				width: Math.abs(shape.x2 - shape.x),
				height: Math.abs(shape.y2 - shape.y),
			};
		case "text": {
			// テキストの場合、推定サイズを使用
			const estimatedWidth = shape.text.length * shape.fontSize * 0.6;
			const estimatedHeight = shape.fontSize * 1.2;
			return {
				x: shape.x,
				y: shape.y,
				width: estimatedWidth,
				height: estimatedHeight,
			};
		}
		default:
			// フォールバック
			return {
				x: (shape as any).x || 0,
				y: (shape as any).y || 0,
				width: 100,
				height: 100,
			};
	}
}

/**
 * カメラ操作に関するコマンドハンドラーを生成
 */
export function createCameraCommands(store: WhiteboardStore) {
	const keyboardCommands: Record<string, CommandHandler> = {
		// ズーム操作
		zoomIn: () => {
			const currentZoom = store.camera.zoom;
			const newZoom = Math.min(5, currentZoom * 1.2);
			store.setCamera({ zoom: newZoom });
			return true;
		},

		zoomOut: () => {
			const currentZoom = store.camera.zoom;
			const newZoom = Math.max(0.1, currentZoom * 0.8);
			store.setCamera({ zoom: newZoom });
			return true;
		},

		zoomReset: () => {
			store.setCamera({ zoom: 1 });
			return true;
		},

		zoomToFit: () => {
			// 全体表示の実装（シェイプがある場合のみ）
			const shapes = Object.values(store.shapes);
			if (shapes.length === 0) return false;

			// すべてのシェイプを含む境界を計算
			let minX = Number.POSITIVE_INFINITY;
			let minY = Number.POSITIVE_INFINITY;
			let maxX = Number.NEGATIVE_INFINITY;
			let maxY = Number.NEGATIVE_INFINITY;

			shapes.forEach((shape) => {
				const bounds = getShapeBounds(shape);
				minX = Math.min(minX, bounds.x);
				minY = Math.min(minY, bounds.y);
				maxX = Math.max(maxX, bounds.x + bounds.width);
				maxY = Math.max(maxY, bounds.y + bounds.height);
			});

			const padding = 50;
			const boundsWidth = maxX - minX + padding * 2;
			const boundsHeight = maxY - minY + padding * 2;

			// ビューポートサイズを取得（仮定値、実際はcanvas要素から取得）
			const viewportWidth = 800;
			const viewportHeight = 600;

			const scaleX = viewportWidth / boundsWidth;
			const scaleY = viewportHeight / boundsHeight;
			const scale = Math.min(scaleX, scaleY, 1); // 最大ズーム1倍

			const centerX = (minX + maxX) / 2;
			const centerY = (minY + maxY) / 2;

			store.setCamera({
				x: viewportWidth / 2 - centerX * scale,
				y: viewportHeight / 2 - centerY * scale,
				zoom: scale,
			});

			return true;
		},

		zoomToSelection: () => {
			const selectedShapes = Array.from(store.selectedShapeIds)
				.map((id) => store.shapes[id])
				.filter(Boolean);

			if (selectedShapes.length === 0) return false;

			// 選択されたシェイプの境界を計算
			let minX = Number.POSITIVE_INFINITY;
			let minY = Number.POSITIVE_INFINITY;
			let maxX = Number.NEGATIVE_INFINITY;
			let maxY = Number.NEGATIVE_INFINITY;

			selectedShapes.forEach((shape) => {
				const bounds = getShapeBounds(shape);
				minX = Math.min(minX, bounds.x);
				minY = Math.min(minY, bounds.y);
				maxX = Math.max(maxX, bounds.x + bounds.width);
				maxY = Math.max(maxY, bounds.y + bounds.height);
			});

			const padding = 100;
			const boundsWidth = maxX - minX + padding * 2;
			const boundsHeight = maxY - minY + padding * 2;

			const viewportWidth = 800;
			const viewportHeight = 600;

			const scaleX = viewportWidth / boundsWidth;
			const scaleY = viewportHeight / boundsHeight;
			const scale = Math.min(scaleX, scaleY, 2); // 最大ズーム2倍

			const centerX = (minX + maxX) / 2;
			const centerY = (minY + maxY) / 2;

			store.setCamera({
				x: viewportWidth / 2 - centerX * scale,
				y: viewportHeight / 2 - centerY * scale,
				zoom: scale,
			});

			return true;
		},

		// パン操作
		panLeft: () => {
			const panAmount = 50 / store.camera.zoom;
			store.setCamera({
				x: store.camera.x + panAmount,
			});
			return true;
		},

		panRight: () => {
			const panAmount = 50 / store.camera.zoom;
			store.setCamera({
				x: store.camera.x - panAmount,
			});
			return true;
		},

		panUp: () => {
			const panAmount = 50 / store.camera.zoom;
			store.setCamera({
				y: store.camera.y + panAmount,
			});
			return true;
		},

		panDown: () => {
			const panAmount = 50 / store.camera.zoom;
			store.setCamera({
				y: store.camera.y - panAmount,
			});
			return true;
		},
	};

	const mouseCommands: Record<string, CommandHandler> = {
		// ホイールズーム
		wheelZoom: (event) => {
			if (!(event instanceof WheelEvent)) return false;

			event.preventDefault();
			const delta = event.deltaY;
			const zoomFactor = delta > 0 ? 0.9 : 1.1;

			// マウス位置を中心にズーム
			const rect = (event.target as HTMLElement)?.getBoundingClientRect();
			if (!rect) return false;

			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;

			const currentCamera = store.camera;
			const newZoom = Math.max(0.1, Math.min(5, currentCamera.zoom * zoomFactor));

			// ズーム中心点の調整
			const zoomDiff = newZoom - currentCamera.zoom;
			const offsetX = (x - currentCamera.x) * (zoomDiff / currentCamera.zoom);
			const offsetY = (y - currentCamera.y) * (zoomDiff / currentCamera.zoom);

			store.setCamera({
				zoom: newZoom,
				x: currentCamera.x - offsetX,
				y: currentCamera.y - offsetY,
			});

			return true;
		},

		// 中クリックドラッグでパン
		"pan:start": () => {
			// ドラッグ開始時の処理（必要に応じて）
			return true;
		},

		"pan:move": (event) => {
			if (!(event as PanEvent).deltaX) return false;

			const panEvent = event as PanEvent;
			const currentCamera = store.camera;

			store.setCamera({
				x: currentCamera.x - panEvent.deltaX / currentCamera.zoom,
				y: currentCamera.y - panEvent.deltaY / currentCamera.zoom,
			});

			return true;
		},

		"pan:end": () => {
			// ドラッグ終了時の処理（必要に応じて）
			return true;
		},

		// 水平スクロール
		horizontalScroll: (event) => {
			if (!(event instanceof WheelEvent)) return false;

			event.preventDefault();
			const scrollAmount = event.deltaY * 0.5;

			store.setCamera({
				x: store.camera.x - scrollAmount / store.camera.zoom,
			});

			return true;
		},
	};

	const gestureCommands: Record<string, CommandHandler> = {
		// ピンチズーム
		"pinchZoom:start": () => true,

		"pinchZoom:move": (event) => {
			const gestureEvent = event as GestureEvent;
			if (!gestureEvent.scale) return false;

			const currentZoom = store.camera.zoom;
			const newZoom = Math.max(0.1, Math.min(5, currentZoom * gestureEvent.scale));

			// ジェスチャーの中心点を基準にズーム
			if (gestureEvent.centerX !== undefined && gestureEvent.centerY !== undefined) {
				const zoomDiff = newZoom - currentZoom;
				const offsetX = (gestureEvent.centerX - store.camera.x) * (zoomDiff / currentZoom);
				const offsetY = (gestureEvent.centerY - store.camera.y) * (zoomDiff / currentZoom);

				store.setCamera({
					zoom: newZoom,
					x: store.camera.x - offsetX,
					y: store.camera.y - offsetY,
				});
			} else {
				store.setCamera({ zoom: newZoom });
			}

			return true;
		},

		"pinchZoom:end": () => true,

		// 2本指パン
		"twoFingerPan:start": () => true,

		"twoFingerPan:move": (event) => {
			const gestureEvent = event as GestureEvent;
			if (gestureEvent.deltaX === undefined || gestureEvent.deltaY === undefined) return false;

			store.setCamera({
				x: store.camera.x + gestureEvent.deltaX / store.camera.zoom,
				y: store.camera.y + gestureEvent.deltaY / store.camera.zoom,
			});

			return true;
		},

		"twoFingerPan:end": () => true,
	};

	return {
		keyboard: keyboardCommands,
		mouse: mouseCommands,
		gesture: gestureCommands,
	};
}
