import { WhiteboardCanvas } from "@usketch/react-canvas";
import { defaultShapePlugins } from "@usketch/shape-plugins";
import { ShapeRegistryProvider } from "@usketch/shape-registry";
import { whiteboardStore } from "@usketch/store";
import { useEffect, useRef, useState } from "react";
import { registerCustomBackgrounds } from "./backgrounds/registerBackgrounds";
import { ToolbarReact } from "./components/ToolbarReact";
import "./styles/app.css";

function App() {
	const canvasRef = useRef<any>(null);
	const shapesAddedRef = useRef(false);
	const backgroundsRegisteredRef = useRef(false);
	const [background, setBackground] = useState<any>({
		id: "usketch.dots",
		config: {
			spacing: 20,
			size: 2,
			color: "#d0d0d0",
		},
	});

	// カスタム背景を登録（一度だけ）
	useEffect(() => {
		if (!backgroundsRegisteredRef.current) {
			backgroundsRegisteredRef.current = true;
			registerCustomBackgrounds();
		}
	}, []);

	// デモ用のシェイプを追加
	const addDemoShapes = () => {
		// Add test shapes only once (protect against StrictMode double render)
		// Skip demo shapes if running E2E tests (when URL has ?e2e=true)
		const isE2E = new URLSearchParams(window.location.search).has("e2e");

		if (!shapesAddedRef.current && !isE2E) {
			shapesAddedRef.current = true;

			// Add some test shapes for demonstration (matching vanilla version)
			setTimeout(() => {
				const testShape1 = {
					id: `test-rect-${Date.now()}`,
					type: "rectangle" as const,
					x: 100,
					y: 100,
					width: 200,
					height: 100,
					rotation: 0,
					opacity: 1,
					strokeColor: "#333",
					fillColor: "#e0e0ff",
					strokeWidth: 2,
				};
				whiteboardStore.getState().addShape(testShape1);
			}, 100);

			// Add another test shape
			setTimeout(() => {
				const testShape2 = {
					id: `test-ellipse-${Date.now()}`,
					type: "ellipse" as const,
					x: 350,
					y: 200,
					width: 150,
					height: 100,
					rotation: 0,
					opacity: 1,
					strokeColor: "#d63384",
					fillColor: "#ffe0e6",
					strokeWidth: 3,
				};
				whiteboardStore.getState().addShape(testShape2);
			}, 200);
		}
	};

	// Canvasの準備完了時の処理
	const handleCanvasReady = (canvas: any) => {
		canvasRef.current = canvas;
		addDemoShapes();
	};

	return (
		<ShapeRegistryProvider plugins={defaultShapePlugins}>
			<div className="app">
				<ToolbarReact onBackgroundChange={setBackground} />
				<div className="whiteboard-container">
					<WhiteboardCanvas
						className="whiteboard"
						background={background}
						onReady={handleCanvasReady}
					/>
				</div>
			</div>
		</ShapeRegistryProvider>
	);
}

export default App;
