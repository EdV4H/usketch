import type {
	ActionRegistry,
	BoardStore,
	CommandRegistry,
	EventBus,
	ExternalContentRegistry,
	LayerManager,
	LodPolicy,
	MarkdownConverterRegistry,
	PluginContext,
	PluginTeardown,
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
import { createActionRegistry } from "./action-registry.js";
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
import { createMarkdownConverterRegistry } from "./markdown-converter-registry.js";
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
	/** Enumerable declarative plugin operations (control HUD / command palette). */
	actions: ActionRegistry;
	/** Markdown-node → shape converters (registered by shape targets / adapters). */
	markdownConverters: MarkdownConverterRegistry;
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
	const actions = createActionRegistry();
	const markdownConverters = createMarkdownConverterRegistry();
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
			createZoomLodPolicy({ enterAt: 0.25, exitAt: 0.4 }),
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
		actions,
		markdownConverters,
	};

	// Bridge store mutations to EventBus
	const unsubMutation = store.onMutation((event) => {
		events.emit(event.type, event.payload);
	});

	// Register and setup plugins.
	// Each plugin's setup may return a per-instance teardown closure; we collect
	// them here and run them in LIFO order on destroy. If a later setup throws,
	// we run the teardowns we already collected (also LIFO) so partially-set-up
	// plugins don't leak state.
	const teardowns: PluginTeardown[] = [];
	try {
		for (const plugin of plugins) {
			pluginRegistry.register(plugin);
			const teardown = await plugin.setup(ctx);
			if (typeof teardown === "function") {
				teardowns.push(teardown);
			}
		}
	} catch (error) {
		for (const teardown of [...teardowns].reverse()) {
			try {
				await teardown();
			} catch (teardownError) {
				console.error("[usketch] plugin teardown failed during setup rollback", teardownError);
			}
		}
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

	let destroyed = false;
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
		actions,
		markdownConverters,
		plugins: pluginRegistry.getAll(),
		destroy() {
			if (destroyed) return;
			destroyed = true;
			for (const teardown of [...teardowns].reverse()) {
				try {
					const result = teardown();
					if (result && typeof (result as Promise<unknown>).catch === "function") {
						(result as Promise<unknown>).catch((error) => {
							console.error("[usketch] async plugin teardown rejected", error);
						});
					}
				} catch (error) {
					console.error("[usketch] plugin teardown threw", error);
				}
			}
			lod.destroy();
			unsubMutation();
		},
	};
}
