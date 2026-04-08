import type {
	BoardStore,
	CommandRegistry,
	EventBus,
	LayerManager,
	LodPolicy,
	PluginContext,
	RenderMode,
	ShapeRegistry,
	ShortcutRegistry,
	ToolRegistry,
	TransientRegistry,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createCommandRegistry } from "./command-registry.js";
import { createEventBus } from "./event-bus.js";
import { createLayerManager } from "./layer-manager.js";
import {
	createCompositeLodPolicy,
	createLodController,
	createShapeCountLodPolicy,
	createZoomLodPolicy,
	type LodControllerInternal,
} from "./lod/index.js";
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
	lod: LodControllerInternal;
	plugins: readonly UsketchPlugin[];
	destroy(): void;
}

export interface CreateAppOptions {
	store: BoardStore;
	plugins: UsketchPlugin[];
	/**
	 * Optional LOD configuration. If omitted, a sensible default is used
	 * (zoom + shape-count composite policy, starting in `interactive` mode).
	 */
	lod?: {
		policy?: LodPolicy;
		initialMode?: RenderMode;
	};
}

export async function createApp(options: CreateAppOptions): Promise<AppInstance> {
	const { store, plugins } = options;

	const layers = createLayerManager();
	const tools = createToolRegistry();
	const shapes = createShapeRegistry();
	const commands = createCommandRegistry();
	const shortcuts = createShortcutRegistry();
	const events = createEventBus();
	const transient = createTransientRegistry();
	const pluginRegistry = createPluginRegistry();

	const lodPolicy =
		options.lod?.policy ??
		createCompositeLodPolicy([
			createZoomLodPolicy({ enterAt: 0.5, exitAt: 0.7 }),
			createShapeCountLodPolicy({ enterAt: 1000, exitAt: 800 }),
		]);
	const lod = createLodController({
		policy: lodPolicy,
		initialMode: options.lod?.initialMode ?? "interactive",
	});

	const ctx: PluginContext = {
		store,
		layers,
		tools,
		shapes,
		commands,
		shortcuts,
		events,
		transient,
		lod,
	};

	// Bridge store mutations to EventBus
	const unsubMutation = store.onMutation((event) => {
		events.emit(event.type, event.payload);
	});

	// Register and setup plugins
	try {
		for (const plugin of plugins) {
			pluginRegistry.register(plugin);
			await plugin.setup(ctx);
		}
	} catch (error) {
		unsubMutation();
		throw error;
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
		lod,
		plugins: pluginRegistry.getAll(),
		destroy() {
			for (const plugin of plugins) {
				plugin.teardown?.();
			}
			lod.destroy();
			unsubMutation();
		},
	};
}
