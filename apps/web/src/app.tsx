import { AppProvider, Canvas } from "@usketch/canvas-engine";
import { type AppInstance, createApp } from "@usketch/core";
import { ellipsePlugin } from "@usketch/plugin-shape-ellipse";
import { freedrawPlugin } from "@usketch/plugin-shape-freedraw";
import { rectPlugin } from "@usketch/plugin-shape-rect";
import { panToolPlugin } from "@usketch/plugin-tool-pan";
import { selectToolPlugin } from "@usketch/plugin-tool-select";
import { createBoardStore } from "@usketch/store";
import { useEffect, useState } from "react";
import { Toolbar } from "./components/toolbar.js";

const plugins = [selectToolPlugin, panToolPlugin, rectPlugin, ellipsePlugin, freedrawPlugin];

export function App() {
	const [app, setApp] = useState<AppInstance | null>(null);

	useEffect(() => {
		let instance: AppInstance | null = null;
		const store = createBoardStore();

		// Register built-in shape layer
		createApp({ store, plugins }).then((created) => {
			instance = created;
			// Register the built-in shapes layer
			instance.layers.register({
				id: "__shapes__",
				order: 50,
				render: () => null, // Handled by Canvas component
			});

			setApp(instance);
		});

		return () => {
			instance?.destroy();
		};
	}, []);

	useEffect(() => {
		if (!app) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Let shortcuts handle tool switching
			const tools = app.tools.getAll();
			for (const [id, def] of tools) {
				if (
					def.shortcut &&
					e.key.toLowerCase() === def.shortcut.toLowerCase() &&
					!e.ctrlKey &&
					!e.metaKey &&
					!e.altKey
				) {
					app.store.setActiveToolId(id);
					return;
				}
			}
			app.shortcuts.handleKeyDown(e);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [app]);

	if (!app) return null;

	return (
		<AppProvider app={app}>
			<div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
				<Canvas />
				<Toolbar />
			</div>
		</AppProvider>
	);
}
