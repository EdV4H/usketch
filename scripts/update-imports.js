#!/usr/bin/env node

const fs = require("node:fs");
const _path = require("node:path");
const glob = require("glob");

// リネームマッピング
const renameMap = {
	// packages/tools
	"./utils/snapEngine": "./utils/snap-engine",
	"../utils/snapEngine": "../utils/snap-engine",
	"../../utils/snapEngine": "../../utils/snap-engine",
	"./machines/toolManager": "./machines/tool-manager",
	"../machines/toolManager": "../machines/tool-manager",
	"./machines/toolMachineFactory": "./machines/tool-machine-factory",
	"../machines/toolMachineFactory": "../machines/tool-machine-factory",
	"./machines/selectTool": "./machines/select-tool",
	"../machines/selectTool": "../machines/select-tool",
	"./machines/rectangleTool": "./machines/rectangle-tool",
	"../machines/rectangleTool": "../machines/rectangle-tool",
	"./machines/drawingTool": "./machines/drawing-tool",
	"../machines/drawingTool": "../machines/drawing-tool",
	"./adapters/toolManagerCompat": "./adapters/tool-manager-compat",
	"../adapters/toolManagerCompat": "../adapters/tool-manager-compat",
	"./adapters/toolManagerAdapter": "./adapters/tool-manager-adapter",
	"../adapters/toolManagerAdapter": "../adapters/tool-manager-adapter",

	// packages/shape-registry
	"./UnifiedShapePluginAdapter": "./unified-shape-plugin-adapter",
	"../UnifiedShapePluginAdapter": "../unified-shape-plugin-adapter",
	"./ShapeRegistry": "./shape-registry",
	"../ShapeRegistry": "../shape-registry",

	// packages/shape-abstraction
	"./ShapeFactory": "./shape-factory",
	"../ShapeFactory": "../shape-factory",
	"./BaseShape": "./base-shape",
	"../BaseShape": "../base-shape",
	"./components/UnifiedShapeRenderer": "./components/unified-shape-renderer",
	"../components/UnifiedShapeRenderer": "../components/unified-shape-renderer",
	"./components/SvgWrapper": "./components/svg-wrapper",
	"../components/SvgWrapper": "../components/svg-wrapper",
	"./components/HtmlWrapper": "./components/html-wrapper",
	"../components/HtmlWrapper": "../components/html-wrapper",

	// packages/react-shapes
	"./Rectangle": "./rectangle",
	"../Rectangle": "../rectangle",
	"./Freedraw": "./freedraw",
	"../Freedraw": "../freedraw",
	"./Ellipse": "./ellipse",
	"../Ellipse": "../ellipse",

	// packages/react-canvas
	"./hooks/useShapeManagement": "./hooks/use-shape-management",
	"../hooks/useShapeManagement": "../hooks/use-shape-management",
	"./hooks/useKeyboardShortcuts": "./hooks/use-keyboard-shortcuts",
	"../hooks/useKeyboardShortcuts": "../hooks/use-keyboard-shortcuts",
	"./hooks/useInteraction": "./hooks/use-interaction",
	"../hooks/useInteraction": "../hooks/use-interaction",
	"./hooks/useCanvas": "./hooks/use-canvas",
	"../hooks/useCanvas": "../hooks/use-canvas",
	"./hooks/useBackgroundRenderer": "./hooks/use-background-renderer",
	"../hooks/useBackgroundRenderer": "../hooks/use-background-renderer",
	"./components/WhiteboardCanvas": "./components/whiteboard-canvas",
	"../components/WhiteboardCanvas": "../components/whiteboard-canvas",
	"./components/ShapeLayer": "./components/shape-layer",
	"../components/ShapeLayer": "../components/shape-layer",
	"./components/Shape": "./components/shape",
	"../components/Shape": "../components/shape",
	"./components/SelectionLayer": "./components/selection-layer",
	"../components/SelectionLayer": "../components/selection-layer",
	"./components/InteractionLayer": "./components/interaction-layer",
	"../components/InteractionLayer": "../components/interaction-layer",
	"./components/DragSelectionLayer": "./components/drag-selection-layer",
	"../components/DragSelectionLayer": "../components/drag-selection-layer",
	"./components/BackgroundLayer": "./components/background-layer",
	"../components/BackgroundLayer": "../components/background-layer",
	"./backgrounds/BackgroundRegistry": "./backgrounds/background-registry",
	"../backgrounds/BackgroundRegistry": "../backgrounds/background-registry",

	// packages/background-presets
	"./components/LinesBackground": "./components/lines-background",
	"../components/LinesBackground": "../components/lines-background",
	"./components/IsometricBackground": "./components/isometric-background",
	"../components/IsometricBackground": "../components/isometric-background",
	"./components/GridBackground": "./components/grid-background",
	"../components/GridBackground": "../components/grid-background",
	"./components/DotsBackground": "./components/dots-background",
	"../components/DotsBackground": "../components/dots-background",

	// apps/whiteboard
	"./App": "./app",
	"../App": "../app",
	"./examples/CustomBackgroundExample": "./examples/custom-background-example",
	"../examples/CustomBackgroundExample": "../examples/custom-background-example",
	"./examples/BackgroundRegistryExample": "./examples/background-registry-example",
	"../examples/BackgroundRegistryExample": "../examples/background-registry-example",
	"./components/ToolbarReact": "./components/toolbar-react",
	"../components/ToolbarReact": "../components/toolbar-react",
	"./components/BackgroundSelector": "./components/background-selector",
	"../components/BackgroundSelector": "../components/background-selector",
	"./backgrounds/registerBackgrounds": "./backgrounds/register-backgrounds",
	"../backgrounds/registerBackgrounds": "../backgrounds/register-backgrounds",
	"./backgrounds/CustomBackgrounds": "./backgrounds/custom-backgrounds",
	"../backgrounds/CustomBackgrounds": "../backgrounds/custom-backgrounds",
};

function updateImports() {
	const files = glob.sync("**/*.{ts,tsx,js,jsx}", {
		ignore: ["node_modules/**", "dist/**", "build/**", ".next/**", "scripts/**"],
	});

	let updatedCount = 0;

	files.forEach((filePath) => {
		let content = fs.readFileSync(filePath, "utf8");
		let updated = false;

		// インポート文を更新
		Object.entries(renameMap).forEach(([oldPath, newPath]) => {
			// import文のパターン
			const importRegex = new RegExp(
				`(from\\s+['"])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(['"])`,
				"g",
			);
			const newContent = content.replace(importRegex, `$1${newPath}$2`);

			if (newContent !== content) {
				content = newContent;
				updated = true;
			}

			// require文のパターン
			const requireRegex = new RegExp(
				`(require\\(['"])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(['"]\\))`,
				"g",
			);
			const newContent2 = content.replace(requireRegex, `$1${newPath}$2`);

			if (newContent2 !== content) {
				content = newContent2;
				updated = true;
			}
		});

		if (updated) {
			fs.writeFileSync(filePath, content, "utf8");
			console.log(`✅ ${filePath}`);
			updatedCount++;
		}
	});

	console.log(`\n📝 ${updatedCount}個のファイルでインポート文を更新しました`);
}

updateImports();
