import { WhiteboardCanvas } from "@usketch/react-canvas";
import { defaultShapePlugins } from "@usketch/shape-plugins";
import type { ShapePlugin } from "@usketch/shape-registry";
import type { Shape } from "@usketch/shared-types";
import { DEFAULT_SHAPE_STYLES } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { useCallback, useEffect, useRef, useState } from "react";
import { registerCustomBackgrounds } from "./backgrounds/register-backgrounds";
import { ConfiguredInputProvider } from "./components/configured-input-provider";
import { DebugPanelContent } from "./components/debug-menu";
import { HistoryPanelContent } from "./components/history-panel";
import { InputSettingsPanel } from "./components/input-settings/input-settings-panel";
import { PropertyPanelContent } from "./components/property-panel";
import { RightSidebar } from "./components/right-sidebar";
import { ToastContainer } from "./components/toast";
import { ToolbarReact } from "./components/toolbar-react";
import { ToastProvider } from "./contexts/toast-context";
import { customShapePlugins } from "./custom-shapes";
import type { EffectPlugin } from "./effects";
import { fadingPinPlugin, pinPlugin, ripplePlugin } from "./effects";
import { useInputCommands } from "./hooks/use-input-commands";
import { SidebarProvider, useRegisterPanel, useSidebar } from "./sidebar/sidebar-context";
import "./styles/app.css";

// Helper function to add shape with delay
const addShapeWithDelay = (shape: Shape, delay: number) => {
	setTimeout(() => {
		whiteboardStore.getState().addShape(shape);
	}, delay);
};

// Calculate delay based on shape index
const calculateDelay = (index: number, baseDelay = 100) => index * baseDelay;

/**
 * Panel Registration Component
 *
 * Registers all sidebar panels when mounted.
 * Automatically unregisters when unmounted.
 */
function SidebarPanels() {
	// Check if we're in development mode
	const isDev = import.meta.env.DEV;

	// Register Property Panel
	useRegisterPanel({
		id: "properties",
		label: "プロパティ",
		icon: "⚙️",
		content: <PropertyPanelContent />,
		order: 1,
	});

	// Register Debug Panel (dev only)
	useRegisterPanel(
		isDev
			? {
					id: "debug",
					label: "デバッグ",
					icon: "🔧",
					content: <DebugPanelContent />,
					devOnly: true,
					order: 2,
				}
			: null,
	);

	// Register History Panel (dev only)
	useRegisterPanel(
		isDev
			? {
					id: "history",
					label: "履歴",
					icon: "🕐",
					content: <HistoryPanelContent />,
					devOnly: true,
					order: 3,
				}
			: null,
	);

	return null;
}

function WhiteboardApp() {
	const canvasRef = useRef<any>(null);
	const shapesAddedRef = useRef(false);
	const backgroundsRegisteredRef = useRef(false);
	const [shapePlugins, setShapePlugins] = useState<ShapePlugin<any>[]>([]);
	const [effectPlugins] = useState<EffectPlugin<any>[]>([ripplePlugin, pinPlugin, fadingPinPlugin]);
	const [isInputSettingsOpen, setIsInputSettingsOpen] = useState(false);

	// Access sidebar state from context
	const { toggleSidebar, isOpen: isSidebarOpen } = useSidebar();

	// Setup input commands with the new system - now inside InputProvider
	useInputCommands({
		onPanelToggle: toggleSidebar,
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
			{/* Register sidebar panels */}
			<SidebarPanels />

			<ToolbarReact
				onBackgroundChange={setBackground}
				isPanelOpen={isSidebarOpen}
				onPanelToggle={toggleSidebar}
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
				<RightSidebar />
			</div>
			<InputSettingsPanel
				isOpen={isInputSettingsOpen}
				onClose={() => setIsInputSettingsOpen(false)}
			/>
			<ToastContainer />
		</div>
	);
}

function App() {
	return (
		<ToastProvider>
			<ConfiguredInputProvider debug={false}>
				<SidebarProvider defaultOpen={true} defaultActiveTab="properties">
					<WhiteboardApp />
				</SidebarProvider>
			</ConfiguredInputProvider>
		</ToastProvider>
	);
}

export default App;
