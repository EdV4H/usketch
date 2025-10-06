import { globalEffectRegistry } from "@usketch/effect-registry";
import { WhiteboardCanvas } from "@usketch/react-canvas";
import { defaultShapePlugins } from "@usketch/shape-plugins";
import type { ShapePlugin } from "@usketch/shape-registry";
import type { Shape } from "@usketch/shared-types";
import { DEFAULT_SHAPE_STYLES } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { useCallback, useEffect, useRef, useState } from "react";
import { registerCustomBackgrounds } from "./backgrounds/register-backgrounds";
import { ConfiguredInputProvider } from "./components/configured-input-provider";
import { DebugMenu } from "./components/debug-menu";
import { InputSettingsPanel } from "./components/input-settings/input-settings-panel";
import { PropertyPanel } from "./components/property-panel/property-panel";
import { ToastContainer } from "./components/toast";
import { ToolbarReact } from "./components/toolbar-react";
import { ToastProvider } from "./contexts/toast-context";
import { customShapePlugins } from "./custom-shapes";
import type { EffectPlugin } from "./effects";
import { fadingPinPlugin, pinPlugin, ripplePlugin } from "./effects";
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

function WhiteboardApp() {
	const canvasRef = useRef<any>(null);
	const shapesAddedRef = useRef(false);
	const backgroundsRegisteredRef = useRef(false);
	const [shapePlugins, setShapePlugins] = useState<ShapePlugin<any>[]>([]);
	const [effectPlugins] = useState<EffectPlugin<any>[]>([ripplePlugin, pinPlugin, fadingPinPlugin]);
	const [isPanelOpen, setIsPanelOpen] = useState(true);
	const [isInputSettingsOpen, setIsInputSettingsOpen] = useState(false);

	// Setup input commands with the new system - now inside InputProvider
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

	// デモ用のシェイプを追加（E2Eテストモード時は追加しない）
	const addDemoShapes = useCallback((_plugins?: ShapePlugin<any>[]) => {
		// Do not add demo shapes during E2E tests
		const isE2E = new URLSearchParams(window.location.search).has("e2e");

		if (!shapesAddedRef.current && !isE2E) {
			shapesAddedRef.current = true;

			// Demo shapes for manual testing only
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

			// Add test shapes for manual testing
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

			// Register effect plugins in the global registry (check if not already registered)
			const registeredTypes = globalEffectRegistry.getAvailableTypes();
			if (!registeredTypes.includes("ripple")) {
				globalEffectRegistry.register(ripplePlugin);
			}
			if (!registeredTypes.includes("pin")) {
				globalEffectRegistry.register(pinPlugin);
			}
			if (!registeredTypes.includes("fading-pin")) {
				globalEffectRegistry.register(fadingPinPlugin);
			}
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
		<div className="app">
			<ToolbarReact
				onBackgroundChange={setBackground}
				isPanelOpen={isPanelOpen}
				onPanelToggle={() => setIsPanelOpen(!isPanelOpen)}
				onInputSettingsToggle={() => setIsInputSettingsOpen(true)}
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
			<InputSettingsPanel
				isOpen={isInputSettingsOpen}
				onClose={() => setIsInputSettingsOpen(false)}
			/>
			<DebugMenu />
			<ToastContainer />
		</div>
	);
}

function App() {
	return (
		<ToastProvider>
			<ConfiguredInputProvider debug={false}>
				<WhiteboardApp />
			</ConfiguredInputProvider>
		</ToastProvider>
	);
}

export default App;
