import type {
	BoardStore,
	CommandRegistry,
	EventBus,
	ExternalContentRegistry,
	LayerManager,
	LodPolicy,
	PluginContext,
	RenderMode,
	SelectionForeground,
	SelectionForegroundRegistry,
	ShapeRegistry,
	ShortcutRegistry,
	ToolRegistry,
	TransientRegistry,
	UiRegistry,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createCommandRegistry } from "./command-registry.js";
import { createEventBus } from "./event-bus.js";
import { createExternalContentRegistry } from "./external-content-registry.js";
import { createLayerManager } from "./layer-manager.js";
import {
	createCompositeLodPolicy,
	createLodController,
	createShapeCountLodPolicy,
	createZoomLodPolicy,
	type LodControllerInternal,
} from "./lod/index.js";
import { createPluginRegistry } from "./plugin-registry.js";
import { createSelectionForegroundRegistry } from "./selection-foreground-registry.js";
import { createShapeRegistry } from "./shape-registry.js";
import { createShortcutRegistry } from "./shortcut-registry.js";
import { createToolRegistry } from "./tool-registry.js";
import { createTransientRegistry } from "./transient-registry.js";

/** Internal id used when `CreateAppOptions.selectionForeground` is provided. */
const APP_SELECTION_FOREGROUND_ID = "__app:selectionForeground";

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
	ui: UiRegistry;
	/** Exposed so canvas-engine can subscribe to the active entry. */
	selectionForeground: SelectionForegroundRegistry;
	/** Exposed so canvas-engine can dispatch drop/paste content. */
	externalContent: ExternalContentRegistry;
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
	/**
	 * Replace the default selection UI (handles, bounding box, marquee) with
	 * a host-provided implementation. Internally registered at priority 100,
	 * so it wins over plugin defaults (priority 0) and typical third-party
	 * plugin overrides (priority 50 by convention). Pass priority explicitly
	 * to override.
	 */
	selectionForeground?: Pick<SelectionForeground, "render"> &
		Partial<Pick<SelectionForeground, "priority" | "order" | "fixed">>;
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
	const selectionForeground = createSelectionForegroundRegistry();
	const ui: UiRegistry = {
		registerSelectionForeground: (entry) => selectionForeground.register(entry),
	};
	const externalContent = createExternalContentRegistry(() => ({
		store,
		shapes,
		commands,
		events,
		externalContent,
	}));
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
		ui,
		externalContent,
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

	// App-level selection foreground option is registered AFTER plugin setup
	// so it wins on ties against a plugin that registered priority 100.
	if (options.selectionForeground) {
		const opt = options.selectionForeground;
		selectionForeground.register({
			id: APP_SELECTION_FOREGROUND_ID,
			priority: opt.priority ?? 100,
			order: opt.order ?? 80,
			fixed: opt.fixed ?? true,
			render: opt.render,
		});
	}

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
		ui,
		selectionForeground,
		externalContent,
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
