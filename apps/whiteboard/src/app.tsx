import { defaultKeymap, defaultMouseMap } from "@usketch/input-presets";
import { InputProvider, WhiteboardCanvas } from "@usketch/react-canvas";
import { defaultShapePlugins } from "@usketch/shape-plugins";
import type { ShapePlugin } from "@usketch/shape-registry";
import type { Shape } from "@usketch/shared-types";
import { DEFAULT_SHAPE_STYLES } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { getEffectTool } from "@usketch/tools";
import { useCallback, useEffect, useRef, useState } from "react";
import { registerCustomBackgrounds } from "./backgrounds/register-backgrounds";
import { DebugMenu } from "./components/debug-menu";
import { PropertyPanel } from "./components/property-panel/property-panel";
import { ToastContainer } from "./components/toast";
import { ToolbarReact } from "./components/toolbar-react";
import { ToastProvider } from "./contexts/toast-context";
import { customShapePlugins } from "./custom-shapes";
import type { EffectPlugin } from "./effects";
import { fadingPinPlugin, pinPlugin, ripplePlugin } from "./effects";
import { createAppEffect } from "./effects/effect-factory";
import { useInputCommands } from "./hooks/use-input-commands";
import "./styles/app.css";

// Helper function to add shape with delay
const addShapeWithDelay = (shape: Shape, delay: number) => {
	setTimeout(() => {
		whiteboardStore.getState().addShape(shape);
	}, delay);
};

// Calculate delay based on shape index
const calculateDelay = (index: number, baseDelay = 100) => index * baseDelay;

function AppContent() {
	const canvasRef = useRef<any>(null);
	const shapesAddedRef = useRef(false);
	const backgroundsRegisteredRef = useRef(false);
	const [shapePlugins, setShapePlugins] = useState<ShapePlugin<any>[]>([]);
	const [effectPlugins] = useState<EffectPlugin<any>[]>([ripplePlugin, pinPlugin, fadingPinPlugin]);
	const [isPanelOpen, setIsPanelOpen] = useState(true);

	// Setup input commands with the new system
	useInputCommands({
		onPanelToggle: () => setIsPanelOpen((prev) => !prev),
	});

	const [background, setBackground] = useState<any>({
		id: "usketch.dots",
		config: {
			spacing: 20,
			size: 2,
			color: "#d0d0d0",
		},
	});

	// デモ用のシェイプを追加（E2Eテストモード時のみ保持）
	const addDemoShapes = useCallback((_plugins?: ShapePlugin<any>[]) => {
		// Only add demo shapes during E2E tests
		const isE2E = new URLSearchParams(window.location.search).has("e2e");

		if (!shapesAddedRef.current && isE2E) {
			shapesAddedRef.current = true;

			// Demo shapes for E2E testing only
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
			];

			// Add test shapes for E2E
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

			// Set up the effect factory for the effect tool
			const effectTool = getEffectTool();
			effectTool.setEffectFactory(createAppEffect);
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

	return (
		<InputProvider keyboardPreset={defaultKeymap} mousePreset={defaultMouseMap} debug={false}>
			<div className="app">
				<ToolbarReact
					onBackgroundChange={setBackground}
					isPanelOpen={isPanelOpen}
					onPanelToggle={() => setIsPanelOpen(!isPanelOpen)}
				/>
				<div className="main-content">
					<div className="whiteboard-container">
						<WhiteboardCanvas
							shapes={shapePlugins.length > 0 ? shapePlugins : defaultShapePlugins}
							effects={effectPlugins}
							className="whiteboard"
							background={background}
							onReady={handleCanvasReady}
						/>
					</div>
					{isPanelOpen && <PropertyPanel />}
				</div>
				<DebugMenu />
				<ToastContainer />
			</div>
		</InputProvider>
	);
}

function App() {
	return (
		<ToastProvider>
			<AppContent />
		</ToastProvider>
	);
}

export default App;
