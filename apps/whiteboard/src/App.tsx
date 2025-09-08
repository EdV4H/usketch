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
			console.log("[App] Loaded shape plugins:", allPlugins.map(p => p.type));
			
			// Add demo shapes after shapes are loaded, pass plugins directly
			if (canvasRef.current && !shapesAddedRef.current) {
				addDemoShapes(allPlugins);
			}
		};
		loadShapes();
	}, []);

	// Add demo shapes when both canvas and plugins are ready
	useEffect(() => {
		if (canvasRef.current && shapePlugins.length > 0 && !shapesAddedRef.current) {
			console.log("[App] Canvas and plugins ready, adding demo shapes");
			addDemoShapes();
		}
	}, [shapePlugins]);

	// デモ用のシェイプを追加
	const addDemoShapes = (plugins?: any[]) => {
		// Add test shapes only once (protect against StrictMode double render)
		// Skip demo shapes if running E2E tests (when URL has ?e2e=true)
		const isE2E = new URLSearchParams(window.location.search).has("e2e");

		if (!shapesAddedRef.current && !isE2E) {
			shapesAddedRef.current = true;
			
			// Use passed plugins or current state
			const availablePlugins = plugins || shapePlugins;
			
			// Debug: Check what shapes are registered
			console.log("[App] Adding demo shapes with plugins:", availablePlugins.map(p => p.type));

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


			// Add new unified abstraction layer shapes
			// Color Picker
			setTimeout(() => {
				try {
					const colorPickerShape = {
						id: `test-color-picker-${Date.now()}`,
						type: "color-picker-unified" as any,
						x: 450,
						y: 400,
						width: 220,
						height: 180,
						rotation: 0,
						opacity: 1,
						selectedColor: "#FF6B6B",
						label: "Color Picker",
					};
					console.log("[App] Adding color-picker-unified shape");
					whiteboardStore.getState().addShape(colorPickerShape as any);
				} catch (error) {
					console.error("[App] Failed to add color-picker-unified:", error);
				}
			}, 700);

			// Interactive Chart
			setTimeout(() => {
				const chartShape = {
					id: `test-chart-${Date.now()}`,
					type: "chart-hybrid-unified" as any,
					x: 700,
					y: 350,
					width: 300,
					height: 200,
					rotation: 0,
					opacity: 1,
					data: [75, 45, 90, 30, 60, 85],
					title: "Interactive Bar Chart",
					color: "#4ECDC4",
				};
				whiteboardStore.getState().addShape(chartShape as any);
			}, 800);

			// Animated Logo
			setTimeout(() => {
				const animatedLogoShape = {
					id: `test-animated-logo-${Date.now()}`,
					type: "animated-logo-unified" as any,
					x: 100,
					y: 550,
					width: 200,
					height: 200,
					rotation: 0,
					opacity: 1,
					primaryColor: "#FF6B6B",
					secondaryColor: "#4ECDC4",
					animationSpeed: 1,
				};
				whiteboardStore.getState().addShape(animatedLogoShape as any);
			}, 900);

			// Video Player
			setTimeout(() => {
				const videoPlayerShape = {
					id: `test-video-player-${Date.now()}`,
					type: "video-player-unified" as any,
					x: 350,
					y: 600,
					width: 320,
					height: 240,
					rotation: 0,
					opacity: 1,
					videoUrl: "",
					title: "Video Player Shape",
					autoplay: false,
				};
				whiteboardStore.getState().addShape(videoPlayerShape as any);
			}, 1000);

			// Unified HTML Counter (improved version)
			setTimeout(() => {
				const htmlCounterUnifiedShape = {
					id: `test-html-counter-unified-${Date.now()}`,
					type: "html-counter-unified" as any,
					x: 700,
					y: 600,
					width: 160,
					height: 100,
					rotation: 0,
					opacity: 1,
					fillColor: "#FFFFFF",
					strokeColor: "#333333",
					strokeWidth: 3,
					count: 0,
				};
				whiteboardStore.getState().addShape(htmlCounterUnifiedShape as any);
			}, 1100);
		}
	};

	// Canvasの準備完了時の処理
	const handleCanvasReady = (canvas: any) => {
		canvasRef.current = canvas;
		// Only add demo shapes if plugins are loaded
		if (shapePlugins.length > 0 && !shapesAddedRef.current) {
			addDemoShapes();
		}
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
