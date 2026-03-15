import type {
	BoardStore,
	CommandRegistry,
	EventBus,
	Layer,
	LayerManager,
	PluginContext,
	ShapeRegistry,
	ShortcutRegistry,
	ToolRegistry,
	TransientRegistry,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createCommandRegistry } from "./command-registry.js";
import { createEventBus } from "./event-bus.js";
import { createLayerManager } from "./layer-manager.js";
import { createPluginRegistry } from "./plugin-registry.js";
import { createShapeRegistry } from "./shape-registry.js";
import { createShortcutRegistry } from "./shortcut-registry.js";
import { createToolRegistry } from "./tool-registry.js";
import { createTransientRegistry } from "./transient-registry.js";

export interface AppInstance {
	store: BoardStore;
	layers: LayerManager;
	tools: ToolRegistry;
	shapes: ShapeRegistry;
	commands: CommandRegistry;
	shortcuts: ShortcutRegistry;
	events: EventBus;
	transient: TransientRegistry;
	plugins: readonly UsketchPlugin[];
	destroy(): void;
}

export interface CreateAppOptions {
	store: BoardStore;
	plugins: UsketchPlugin[];
	layers?: Layer[];
}

export async function createApp(options: CreateAppOptions): Promise<AppInstance> {
	const { store, plugins, layers: layerConfigs = [] } = options;

	const layers = createLayerManager();

	// Built-in shapes layer (default order: 50)
	const shapesConfig = layerConfigs.find((l) => l.id === "__shapes__");
	layers.register({ id: "__shapes__", order: 50, ...shapesConfig });

	// Register additional layers
	for (const config of layerConfigs) {
		if (config.id === "__shapes__") continue;
		layers.register(config);
	}
	const tools = createToolRegistry();
	const shapes = createShapeRegistry();
	const commands = createCommandRegistry();
	const shortcuts = createShortcutRegistry();
	const events = createEventBus();
	const transient = createTransientRegistry();
	const pluginRegistry = createPluginRegistry();

	const ctx: PluginContext = {
		store,
		layers,
		tools,
		shapes,
		commands,
		shortcuts,
		events,
		transient,
	};

	// Register and setup plugins
	for (const plugin of plugins) {
		pluginRegistry.register(plugin);
		await plugin.setup(ctx);
	}

	// Register core shortcuts
	shortcuts.register("Ctrl+Z", () => commands.undo());
	shortcuts.register("Ctrl+Shift+Z", () => commands.redo());

	return {
		store,
		layers,
		tools,
		shapes,
		commands,
		shortcuts,
		events,
		transient,
		plugins: pluginRegistry.getAll(),
		destroy() {
			for (const plugin of plugins) {
				plugin.teardown?.();
			}
		},
	};
}
