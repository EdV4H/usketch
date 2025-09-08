import { WhiteboardCanvas } from "@usketch/react-canvas";
import { defaultShapePlugins } from "@usketch/shape-plugins";
import { DEFAULT_SHAPE_STYLES } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { useEffect, useRef, useState } from "react";
import { registerCustomBackgrounds } from "./backgrounds/registerBackgrounds";
import { ToolbarReact } from "./components/ToolbarReact";
import { customShapePlugins } from "./custom-shapes";
import "./styles/app.css";

function App() {
	const canvasRef = useRef<any>(null);
	const shapesAddedRef = useRef(false);
	const backgroundsRegisteredRef = useRef(false);
	const [shapePlugins, setShapePlugins] = useState<any[]>([]);
	const [background, setBackground] = useState<any>({
		id: "usketch.dots",
		config: {
			spacing: 20,
			size: 2,
			color: "#d0d0d0",
		},
	});

	// カスタム背景とシェイプを登録（一度だけ）
	useEffect(() => {
		if (!backgroundsRegisteredRef.current) {
			backgroundsRegisteredRef.current = true;
			registerCustomBackgrounds();
		}

		// Load custom shapes and combine with default shapes
		const loadShapes = async () => {
			const customPlugins = await customShapePlugins();
			const allPlugins = [...defaultShapePlugins, ...customPlugins];
			setShapePlugins(allPlugins);
		};
		loadShapes();
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
					opacity: DEFAULT_SHAPE_STYLES.opacity,
					strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
					fillColor: DEFAULT_SHAPE_STYLES.fillColor,
					strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
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
					opacity: DEFAULT_SHAPE_STYLES.opacity,
					strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
					fillColor: DEFAULT_SHAPE_STYLES.fillColor,
					strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
				};
				whiteboardStore.getState().addShape(testShape2);
			}, 200);

			// Add custom shapes for demonstration
			setTimeout(() => {
				const starShape = {
					id: `test-star-${Date.now()}`,
					type: "star" as any,
					x: 550,
					y: 100,
					width: 120,
					height: 120,
					rotation: 0,
					opacity: 1,
					strokeColor: "#FFB700",
					fillColor: "#FFD700",
					strokeWidth: 2,
					points: 5,
					innerRadius: 30,
					outerRadius: 60,
				};
				whiteboardStore.getState().addShape(starShape as any);
			}, 300);

			setTimeout(() => {
				const heartShape = {
					id: `test-heart-${Date.now()}`,
					type: "heart" as any,
					x: 700,
					y: 200,
					width: 100,
					height: 90,
					rotation: 0,
					opacity: 1,
					strokeColor: "#FF1493",
					fillColor: "#FF69B4",
					strokeWidth: 2,
				};
				whiteboardStore.getState().addShape(heartShape as any);
			}, 400);

			setTimeout(() => {
				const triangleShape = {
					id: `test-triangle-${Date.now()}`,
					type: "triangle" as any,
					x: 200,
					y: 250,
					width: 100,
					height: 100,
					rotation: 0,
					opacity: 1,
					strokeColor: "#008B8B",
					fillColor: "#00CED1",
					strokeWidth: 2,
					direction: "up",
				};
				whiteboardStore.getState().addShape(triangleShape as any);
			}, 500);

			// Add HTML-based counter shape
			setTimeout(() => {
				const htmlCounterShape = {
					id: `test-html-counter-${Date.now()}`,
					type: "html-counter" as any,
					x: 250,
					y: 400,
					width: 160,
					height: 100,
					rotation: 0,
					opacity: 1,
					strokeColor: "#6B46C1",
					fillColor: "#F3E8FF",
					strokeWidth: 3,
					count: 42,
				};
				whiteboardStore.getState().addShape(htmlCounterShape as any);
			}, 600);
		}
	};

	// Canvasの準備完了時の処理
	const handleCanvasReady = (canvas: any) => {
		canvasRef.current = canvas;
		addDemoShapes();
	};

	return (
		<div className="app">
			<ToolbarReact onBackgroundChange={setBackground} />
			<div className="whiteboard-container">
				<WhiteboardCanvas
					shapes={shapePlugins.length > 0 ? shapePlugins : defaultShapePlugins}
					className="whiteboard"
					background={background}
					onReady={handleCanvasReady}
				/>
			</div>
		</div>
	);
}

export default App;
