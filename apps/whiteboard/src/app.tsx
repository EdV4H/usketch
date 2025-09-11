import { getAllPresetPlugins as getAllEffectPlugins } from "@usketch/effect-presets";
import type { EffectPlugin } from "@usketch/effect-registry";
import { WhiteboardCanvas } from "@usketch/react-canvas";
import { defaultShapePlugins } from "@usketch/shape-plugins";
import type { ShapePlugin } from "@usketch/shape-registry";
import type { Effect, Shape } from "@usketch/shared-types";
import { DEFAULT_SHAPE_STYLES } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { useCallback, useEffect, useRef, useState } from "react";
import { registerCustomBackgrounds } from "./backgrounds/register-backgrounds";
import { ToolbarReact } from "./components/toolbar-react";
import { customShapePlugins } from "./custom-shapes";
import "./styles/app.css";

// Helper function to add shape with delay
const addShapeWithDelay = (shape: Shape, delay: number) => {
	setTimeout(() => {
		whiteboardStore.getState().addShape(shape);
	}, delay);
};

// Calculate delay based on shape index
const calculateDelay = (index: number, baseDelay = 100) => index * baseDelay;

function App() {
	const canvasRef = useRef<any>(null);
	const shapesAddedRef = useRef(false);
	const backgroundsRegisteredRef = useRef(false);
	const [shapePlugins, setShapePlugins] = useState<ShapePlugin<any>[]>([]);
	const [effectPlugins] = useState<EffectPlugin<any>[]>(getAllEffectPlugins());
	const [background, setBackground] = useState<any>({
		id: "usketch.dots",
		config: {
			spacing: 20,
			size: 2,
			color: "#d0d0d0",
		},
	});

	// デモ用のシェイプを追加
	const addDemoShapes = useCallback((_plugins?: ShapePlugin<any>[]) => {
		// Add test shapes only once (protect against StrictMode double render)
		// Skip demo shapes if running E2E tests (when URL has ?e2e=true)
		const isE2E = new URLSearchParams(window.location.search).has("e2e");

		if (!shapesAddedRef.current && !isE2E) {
			shapesAddedRef.current = true;

			// Demo shapes data
			const demoShapes: any[] = [
				{
					id: `test-rect-${Date.now()}`,
					type: "rectangle",
					x: 100,
					y: 100,
					width: 200,
					height: 100,
					rotation: 0,
					opacity: DEFAULT_SHAPE_STYLES.opacity,
					strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
					fillColor: DEFAULT_SHAPE_STYLES.fillColor,
					strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
				},
				{
					id: `test-ellipse-${Date.now() + 1}`,
					type: "ellipse",
					x: 350,
					y: 200,
					width: 150,
					height: 100,
					rotation: 0,
					opacity: DEFAULT_SHAPE_STYLES.opacity,
					strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
					fillColor: DEFAULT_SHAPE_STYLES.fillColor,
					strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
				},
				{
					id: `test-star-${Date.now() + 2}`,
					type: "star",
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
				},
				{
					id: `test-heart-${Date.now() + 3}`,
					type: "heart",
					x: 700,
					y: 200,
					width: 100,
					height: 90,
					rotation: 0,
					opacity: 1,
					strokeColor: "#FF1493",
					fillColor: "#FF69B4",
					strokeWidth: 2,
				},
				{
					id: `test-triangle-${Date.now() + 4}`,
					type: "triangle",
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
				},
				{
					id: `test-color-picker-${Date.now() + 5}`,
					type: "color-picker",
					x: 450,
					y: 400,
					width: 220,
					height: 180,
					rotation: 0,
					opacity: 1,
					selectedColor: "#FF6B6B",
					label: "Color Picker",
				},
				{
					id: `test-chart-${Date.now() + 6}`,
					type: "chart-hybrid",
					x: 700,
					y: 350,
					width: 300,
					height: 200,
					rotation: 0,
					opacity: 1,
					data: [75, 45, 90, 30, 60, 85],
					title: "Interactive Bar Chart",
					color: "#4ECDC4",
				},
				{
					id: `test-animated-logo-${Date.now() + 7}`,
					type: "animated-logo",
					x: 100,
					y: 550,
					width: 200,
					height: 200,
					rotation: 0,
					opacity: 1,
					primaryColor: "#FF6B6B",
					secondaryColor: "#4ECDC4",
					animationSpeed: 1,
				},
				{
					id: `test-video-player-${Date.now() + 8}`,
					type: "video-player",
					x: 350,
					y: 600,
					width: 320,
					height: 240,
					rotation: 0,
					opacity: 1,
					videoUrl: "",
					title: "Video Player Shape",
					autoplay: false,
				},
				{
					id: `test-html-counter-${Date.now() + 9}`,
					type: "html-counter",
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
				},
			];

			// Add all demo shapes with calculated delays
			demoShapes.forEach((shape, index) => {
				addShapeWithDelay(shape, calculateDelay(index + 1));
			});
		}
	}, []);

	// カスタム背景とシェイプを登録（一度だけ）
	useEffect(() => {
		if (!backgroundsRegisteredRef.current) {
			backgroundsRegisteredRef.current = true;
			registerCustomBackgrounds();
		}

		// Load custom shapes and combine with default shapes
		const loadShapes = () => {
			const allPlugins = [...defaultShapePlugins, ...customShapePlugins] as ShapePlugin<any>[];
			setShapePlugins(allPlugins);

			// Add demo shapes after shapes are loaded, pass plugins directly
			if (canvasRef.current && !shapesAddedRef.current) {
				addDemoShapes(allPlugins);
			}
		};
		loadShapes();
	}, [addDemoShapes]);

	// Add demo shapes when both canvas and plugins are ready
	useEffect(() => {
		if (canvasRef.current && shapePlugins.length > 0 && !shapesAddedRef.current) {
			addDemoShapes();
		}
	}, [shapePlugins, addDemoShapes]);

	// Canvasの準備完了時の処理
	const handleCanvasReady = (canvas: any) => {
		canvasRef.current = canvas;
		// Only add demo shapes if plugins are loaded
		if (shapePlugins.length > 0 && !shapesAddedRef.current) {
			addDemoShapes();
		}
	};

	// Add ripple effect on canvas click
	useEffect(() => {
		const handleCanvasClick = (e: MouseEvent) => {
			// Only add ripple if clicking on empty canvas (not on shapes)
			const target = e.target as HTMLElement;
			const canvasElement = target.closest(".whiteboard-canvas");

			// Check if we clicked on the canvas but not on a shape
			if (canvasElement && !target.closest("[data-shape-id]")) {
				const rect = canvasElement.getBoundingClientRect();
				const camera = whiteboardStore.getState().camera;

				// Convert screen coordinates to world coordinates
				const x = (e.clientX - rect.left - camera.x) / camera.zoom;
				const y = (e.clientY - rect.top - camera.y) / camera.zoom;

				// Add a ripple effect at the click position
				const rippleEffect: Effect = {
					id: `ripple-${Date.now()}`,
					type: "ripple",
					x,
					y,
					radius: 60, // Increased from 30
					color: "#4ECDC4",
					opacity: 0.8, // Increased from 0.5
					createdAt: Date.now(),
					duration: 600, // Slightly longer duration
				};

				console.log("Adding ripple effect at", { x, y }, rippleEffect);
				whiteboardStore.getState().addEffect(rippleEffect);
			}
		};

		document.addEventListener("click", handleCanvasClick);
		return () => document.removeEventListener("click", handleCanvasClick);
	}, []);

	return (
		<div className="app">
			<ToolbarReact onBackgroundChange={setBackground} />
			<div className="whiteboard-container">
				<WhiteboardCanvas
					shapes={shapePlugins.length > 0 ? shapePlugins : defaultShapePlugins}
					effects={effectPlugins}
					className="whiteboard"
					background={background}
					onReady={handleCanvasReady}
				/>
			</div>
		</div>
	);
}

export default App;
