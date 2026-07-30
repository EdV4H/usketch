import type {
	ActionRegistry,
	BoardStore,
	CommandRegistry,
	EventBus,
	ExternalContentRegistry,
	HudRegistry,
	LayerManager,
	LodPolicy,
	PluginContext,
	PluginInfoRegistry,
	PluginTeardown,
	RenderMode,
	SelectionForeground,
	SelectionForegroundRegistry,
	ServiceRegistry,
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
import { createHudRegistry } from "./hud-registry.js";
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
import { createServiceRegistry } from "./service-registry.js";
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
	/** Declarative HUD contributions (live settings + custom panels) by plugin. */
	hud: HudRegistry;
	/** String-keyed slot for plugin-provided services (IoC). */
	services: ServiceRegistry;
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
	const hud = createHudRegistry();
	const services = createServiceRegistry();
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

	// Read-only view of active plugins (id + name) for UIs that group by plugin.
	const pluginInfo: PluginInfoRegistry = {
		getAll: () => pluginRegistry.getAll().map((p) => ({ id: p.id, name: p.name })),
	};

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
		hud,
		plugins: pluginInfo,
		services,
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
			// Per-plugin scoped context: `actions`/`hud` registrations (including any
			// made later from callbacks) are auto-attributed to this plugin's id.
			// Explicit public-surface wrappers (not `{ ...registry }`) so the internal
			// attribution helpers (registerFor/registerSettingsFor/registerPanelFor)
			// are NOT reachable from a plugin's context, even via `as any`.
			const scopedActions: ActionRegistry = {
				register: (action) => actions.registerFor(plugin.id, action),
				unregister: actions.unregister,
				get: actions.get,
				getAll: actions.getAll,
				getOrdered: actions.getOrdered,
				subscribe: actions.subscribe,
			};
			const scopedHud: HudRegistry = {
				registerSettings: (descriptor) => hud.registerSettingsFor(plugin.id, descriptor),
				registerPanel: (panel) => hud.registerPanelFor(plugin.id, panel),
				getSettings: hud.getSettings,
				getPanels: hud.getPanels,
				subscribe: hud.subscribe,
			};
			const scopedCtx: PluginContext = { ...ctx, actions: scopedActions, hud: scopedHud };
			const teardown = await plugin.setup(scopedCtx);
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

	// Register core shortcuts (Mod = Cmd on macOS, Ctrl elsewhere)
	shortcuts.register("Mod+Z", () => commands.undo(), {
		label: "Undo",
		category: "history",
	});
	shortcuts.register("Mod+Shift+Z", () => commands.redo(), {
		label: "Redo",
		category: "history",
	});

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
		hud,
		services,
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
