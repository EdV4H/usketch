import type { ComponentType, ReactElement } from "react";
import type { BoundingBox, Point, Viewport } from "./geometry.js";
import type { LodController, RenderMode } from "./lod.js";
import type { ResizeHandle, ShapeData, ShapeStyle } from "./shape.js";
import type { Theme } from "./theme.js";

// ── Layer System ──

export interface LayerRenderContext {
	viewport: Viewport;
	shapes: ReadonlyMap<string, ShapeData>;
	/** Shapes sorted by zIndex ascending (back to front). Reflects any active filter. */
	shapesSorted: readonly ShapeData[];
	selection: ReadonlySet<string>;
	theme: Theme;
	/** Current LOD render mode. Layers should adapt their output accordingly. */
	renderMode: RenderMode;
}

export type RenderTarget = "svg" | "html";

// ── GPU Rendering ──

export type GpuPrimitiveKind = "rect" | "ellipse" | "polyline" | "polygon";

export interface GpuPrimitive {
	kind: GpuPrimitiveKind;
	bounds: BoundingBox;
	cornerRadius?: number;
	vertices?: Float32Array;
	indices?: Uint16Array;
	fill: [number, number, number, number];
	stroke: [number, number, number, number];
	strokeWidth: number;
	opacity: number;
	rotation?: number;
}

export interface Layer {
	id: string;
	order: number;
	render: (ctx: LayerRenderContext) => ReactElement | null;
	interactable?: boolean;
	fixed?: boolean;
}

export interface LayerManager {
	register(layer: Layer): void;
	unregister(layerId: string): void;
	getLayers(): readonly Layer[];
}

// ── Selection Foreground (UI extension point) ──

/**
 * A replaceable rendering of the selection UI (handles, bounding box, marquee,
 * rotation handle, etc.). Apps and plugins can register one or more entries;
 * the registry picks a single winner using `priority` (higher wins) with
 * last-registered winning on ties.
 *
 * Priority conventions (recommended, not enforced):
 * - `0`   — plugin default (e.g. `usketch-plugin-tool-select`).
 * - `50`  — third-party plugin custom UI.
 * - `100` — `createApp({ selectionForeground })` host option.
 *
 * The `render` function has the same shape as a regular `Layer.render` so
 * the active entry can be mounted as an internal canvas layer.
 */
export interface SelectionForeground {
	id: string;
	priority: number;
	/** z-order hint when mounted as a layer. Defaults to 80. */
	order?: number;
	/** Whether the mounted layer should skip viewport transform. Defaults to true. */
	fixed?: boolean;
	render: (ctx: LayerRenderContext) => ReactElement | null;
}

export interface SelectionForegroundRegistry {
	/** Register an entry. Re-registering the same `id` replaces and bumps to last (wins on ties). */
	register(entry: SelectionForeground): () => void;
	unregister(id: string): void;
	/** The currently winning entry, or `null` when nothing is registered. */
	getActive(): SelectionForeground | null;
	/** Notified whenever the active entry changes. */
	subscribe(listener: () => void): () => void;
}

export interface UiRegistry {
	registerSelectionForeground(entry: SelectionForeground): () => void;
}

// ── External Content (drop / paste / URL handlers) ──

/**
 * The kind of payload an external-content handler operates on.
 * - `"file"` — file drop or image paste from the clipboard.
 * - `"url"`  — URL drop (text/uri-list) or pasted URL string.
 * - `"text"` — plain text drop or paste that is not a URL.
 *
 * Embeds (YouTube, Figma, Loom, …) are intentionally not their own kind —
 * register a `"url"` handler whose `match` checks the host name.
 */
export type ExternalContentKind = "file" | "url" | "text";

/** How the content arrived. Same `kind` may behave differently per source. */
export type ExternalContentVia = "drop" | "paste";

export interface ExternalContentBase {
	via: ExternalContentVia;
}

export interface ExternalContentFile extends ExternalContentBase {
	kind: "file";
	files: readonly File[];
}

export interface ExternalContentUrl extends ExternalContentBase {
	kind: "url";
	url: string;
	/** Where the URL string came from. `"uri-list"` is RFC 2483 `text/uri-list`. */
	source: "uri-list" | "text";
}

export interface ExternalContentText extends ExternalContentBase {
	kind: "text";
	text: string;
	/** Companion `text/html` payload when paste carried one (e.g. SVG markup). */
	html: string | null;
}

export type ExternalContent = ExternalContentFile | ExternalContentUrl | ExternalContentText;

/** Narrow {@link ExternalContent} to the variant matching the given kind. */
export type ExternalContentOf<K extends ExternalContentKind> = Extract<
	ExternalContent,
	{ kind: K }
>;

/**
 * Context passed to a handler's `match` and `handle`. Mirrors {@link ToolContext}
 * plus a self-reference so handlers can re-dispatch (e.g. an embed URL handler
 * that delegates to a generic URL handler on miss).
 */
export interface ExternalContentHandlerCtx {
	store: BoardStore;
	shapes: ShapeRegistry;
	commands: CommandRegistry;
	events: EventBus;
	externalContent: ExternalContentRegistry;
}

/**
 * A registered handler for one kind of external content.
 *
 * Resolution at dispatch time:
 * 1. Filter by `kind`.
 * 2. Call each handler's `match`. Errors are caught, logged, and treated as
 *    `false` so a single misbehaving handler can't block the rest.
 * 3. Among matching handlers, the highest `order` wins. On ties the
 *    most-recently-registered handler wins (last-wins) — mirroring
 *    {@link SelectionForegroundRegistry}.
 * 4. Exactly one handler's `handle` is invoked. If it throws or rejects,
 *    the error is logged and the dispatch ends — no other handler is tried.
 *
 * Priority conventions (recommended, not enforced):
 * - `0`   — plugin default (e.g. `usketch-plugin-shape-image` image-file handler).
 * - `50`  — third-party plugin.
 * - `100` — app-level override.
 */
export interface ExternalContentHandler<K extends ExternalContentKind = ExternalContentKind> {
	/** Required. Used for `unregister` and for last-wins re-register semantics. */
	id: string;
	kind: K;
	/**
	 * Side-effect-free predicate. Heavy work (fetch, decode) belongs in
	 * `handle`. If `match` throws, it is logged and treated as `false`.
	 */
	match: (content: ExternalContentOf<K>, ctx: ExternalContentHandlerCtx) => boolean;
	/**
	 * Invoked at most once per dispatch — the single winning handler. May be
	 * `async`; the registry awaits the returned promise. Errors are logged
	 * and end the dispatch (the next-best handler is NOT tried).
	 */
	handle: (content: ExternalContentOf<K>, ctx: ExternalContentHandlerCtx) => void | Promise<void>;
	/** Default `0`. Larger values win; on ties, the last-registered wins. */
	order?: number;
}

export interface ExternalContentRegistry {
	/**
	 * Register a handler. Re-registering the same `id` replaces the previous
	 * entry and bumps it to the end of insertion order (so it wins on ties).
	 * Returns an `unsubscribe` function.
	 */
	register<K extends ExternalContentKind>(handler: ExternalContentHandler<K>): () => void;
	unregister(id: string): void;
	/**
	 * Dispatch a piece of external content. Resolves to `true` if a handler's
	 * `handle` was invoked (even if it threw — the throw is logged), or
	 * `false` if no handler matched.
	 */
	dispatch<K extends ExternalContentKind>(content: ExternalContentOf<K>): Promise<boolean>;
	/** All currently-registered handlers (insertion order). For debugging / inspectors. */
	getHandlers(): readonly ExternalContentHandler[];
}

// ── Shape System ──

/**
 * Read-only canvas view passed to shape serialization hooks
 * (`serializeForAi` / `serializeForRecognition`). Intentionally minimal —
 * serializers must not mutate the store or emit events.
 */
export interface ShapeSerializeContext {
	/** All shapes currently on the canvas. Useful for cross-shape lookups
	 *  (e.g. resolving connector endpoints or nearby labels). */
	readonly shapes: ReadonlyMap<string, ShapeData>;
	/** Registry view for delegating to other shape types' serializers.
	 *  Narrowed to read-only methods so serializers can't accidentally
	 *  `register(...)` and mutate global plugin state during serialization. */
	readonly registry: Pick<ShapeRegistry, "get" | "getAll">;
}

export interface ShapeDefinition {
	render: (data: ShapeData) => ReactElement;
	getBounds: (data: ShapeData) => BoundingBox;
	hitTest: (data: ShapeData, point: Point) => boolean;
	resize: (data: ShapeData, handle: ResizeHandle, delta: Point) => ShapeData;
	createDefault: (params: { id: string; x: number; y: number }) => ShapeData;
	renderTarget?: RenderTarget;
	minSize?: { width: number; height: number };
	/** Whether the shape can be resized by the user. Default: true. */
	resizable?: boolean;
	/** Shape-specific move logic (e.g. updating absolute point arrays). Default: update x/y only. */
	move?: (data: ShapeData, dx: number, dy: number) => Partial<ShapeData>;
	/** Fit shape data to new bounding box (for multi-resize). Default: apply newBounds as-is. */
	applyBounds?: (data: ShapeData, newBounds: BoundingBox) => Partial<ShapeData>;
	/** Return GPU-renderable primitive data, or null to fall back to DOM rendering. */
	gpuPrimitive?: (data: ShapeData) => GpuPrimitive | null;
	/**
	 * Lightweight component used in LOD (zoomed-out) mode. If omitted, the DOM
	 * renderer falls back to a solid-fill rectangle using `shape.style.fill`.
	 */
	simplifiedComponent?: ComponentType<{ shape: ShapeData }>;
	/**
	 * Project this shape into a flat record for AI prompt embedding
	 * (ai-agent / ai-copilot). Return value is merged with core fields
	 * ({id, type, x, y, w, h}) by callers; values that are `undefined`,
	 * `null`, or `""` are dropped (zeros are kept), and non-finite numbers
	 * (NaN / Infinity) are dropped.
	 *
	 * Reserved keys: callers ignore `id` / `type` / `x` / `y` / `w` / `h` /
	 * `style` if a plugin returns them, so don't bother emitting them — the
	 * caller writes core fields itself and never lets a plugin override them.
	 *
	 * Conventions for cross-shape interop (followed by ai-agent and ai-copilot):
	 * - `text: string` — human-readable label/content. AI consumers may read
	 *   this from neighbouring shapes to build context (e.g. labels inside a
	 *   selected rectangle).
	 * - `pointCount: number` — vertex count for point-list shapes. Useful for
	 *   token-budget estimation.
	 *
	 * All other keys are shape-specific and have no cross-shape meaning.
	 *
	 * Plugins are responsible for keeping the returned values prompt-friendly:
	 * don't return base64 Data URLs, large arrays, or other payloads that
	 * could blow LLM token budgets — return summaries instead. The caller
	 * does NOT truncate, so a misbehaving plugin can degrade every prompt.
	 */
	serializeForAi?: (data: ShapeData, ctx?: ShapeSerializeContext) => Record<string, unknown>;
	/**
	 * Project this shape into a recognition-friendly form (e.g. handwriting
	 * stroke, image source for OCR). Used by ai-recognize. Returns `null` for
	 * shapes that aren't recognizable. Return value type is `unknown` so shape
	 * plugins don't import recognition-specific types — the caller (ai-recognize)
	 * narrows via type guards.
	 */
	serializeForRecognition?: (data: ShapeData, ctx?: ShapeSerializeContext) => unknown;
	/**
	 * Project this shape into a key/value map for the debug HUD shapes panel.
	 * Optimized for human readability — full values, descriptive keys, no
	 * token-budget compression (unlike `serializeForAi`). If omitted, the HUD
	 * falls back to listing top-level keys outside the core ShapeData set.
	 */
	debugFields?: (data: ShapeData) => Record<string, unknown>;
}

export interface ShapeRegistry {
	register(type: string, definition: ShapeDefinition): void;
	get(type: string): ShapeDefinition | undefined;
	getAll(): ReadonlyMap<string, ShapeDefinition>;
}

// ── Tool System ──

export interface ToolDefinition {
	icon: () => ReactElement;
	cursor?: string;
	shortcut?: string;
	order?: number;
	onActivate?: (ctx: ToolContext) => void;
	onDeactivate?: (ctx: ToolContext) => void;
	onPointerDown?: (ctx: ToolContext, event: CanvasPointerEvent) => void;
	onPointerMove?: (ctx: ToolContext, event: CanvasPointerEvent) => void;
	onPointerUp?: (ctx: ToolContext, event: CanvasPointerEvent) => void;
}

export interface ToolContext {
	store: BoardStore;
	shapes: ShapeRegistry;
	commands: CommandRegistry;
	events: EventBus;
}

export interface CanvasPointerEvent {
	worldPoint: Point;
	screenPoint: Point;
	shiftKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	button: number;
}

export interface CanvasWheelEvent {
	screenPoint: Point;
	worldPoint: Point;
	deltaX: number;
	deltaY: number;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}

export interface ToolRegistry {
	register(id: string, definition: ToolDefinition): void;
	get(id: string): ToolDefinition | undefined;
	getAll(): ReadonlyMap<string, ToolDefinition>;
	getOrdered(): readonly { id: string; definition: ToolDefinition }[];
}

// ── Command System ──

export interface Command {
	execute(): void;
	undo(): void;
}

export interface CommandRegistry {
	execute(command: Command): void;
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
	getHistorySize(): number;
	getCursor(): number;
}

// ── Shortcut System ──

export interface ShortcutRegistry {
	register(combo: string, callback: () => void): () => void;
	handleKeyDown(event: KeyboardEvent): boolean;
}

// ── Event Bus ──

/**
 * コアイベントの型マップ。
 * プラグインは独自イベントを自由に emit/on できる（string フォールバック）。
 * 既知イベントはここに追加することで型安全な emit/on が可能になる。
 */
export interface CoreEventMap {
	"canvas:pointerdown": { worldX: number; worldY: number };
	"canvas:pointermove": { worldX: number; worldY: number };
	"canvas:pointerup": { worldX: number; worldY: number };
	"layers:changed": Record<string, never>;
	"filter:changed": { predicate: ((shape: ShapeData) => boolean) | null; config: unknown };
	"time-travel:enter": { shapes: Map<string, ShapeData> };
	"time-travel:exit": Record<string, never>;
	"shapes:move-end": { shapeIds: string[] };
	"snap:configure": { enabled: boolean };
	"partition:request": { partitions: string[] };
	"canvas:drop": { files: FileList; worldPoint: Point; screenPoint: Point };
}

export interface EventBus {
	on<K extends keyof CoreEventMap>(event: K, handler: (data: CoreEventMap[K]) => void): () => void;
	on<T = unknown>(event: string, handler: (data: T) => void): () => void;
	emit<K extends keyof CoreEventMap>(event: K, data: CoreEventMap[K]): void;
	emit<T = unknown>(event: string, data: T): void;
	/**
	 * Suspend event delivery. `emit()` becomes a no-op until every outstanding
	 * `pause()` has been matched by a `resume()` — calls are ref-counted, so
	 * independent callers can nest safely (the bus stays paused as long as any
	 * caller still holds a pause). Subscription via `on()` (and unsubscription
	 * via the function it returns) keeps working; handlers registered while
	 * paused will receive events emitted after the final `resume()`. Each
	 * `pause()` MUST be paired with exactly one `resume()` — leaking a `pause()`
	 * will silently drop every subsequent event in the app.
	 */
	pause(): void;
	/** Decrement the pause counter; resumes delivery once it reaches zero. */
	resume(): void;
	isPaused(): boolean;
}

// ── Transient System ──

export interface TransientObject {
	id: string;
	type: string;
	sourceUserId: string;
	position: Point;
	data: Record<string, unknown>;
	ttl?: number;
	createdAt: number;
}

export interface TransientRenderer {
	render: (obj: TransientObject, ctx: LayerRenderContext) => ReactElement;
}

export interface TransientRegistry {
	registerType(type: string, renderer: TransientRenderer): void;
	getRenderer(type: string): TransientRenderer | undefined;
	emit(obj: TransientObject): void;
	dismiss(id: string): void;
	getAll(): ReadonlyMap<string, TransientObject>;
	subscribe(listener: () => void): () => void;
}

// ── Store ──

export interface StoreEvent {
	type: string;
	payload?: unknown;
}

export interface BoardStore {
	getShapes(): ReadonlyMap<string, ShapeData>;
	/** Return shapes sorted by zIndex (ascending = back to front). Cached internally. */
	getShapesSorted(): readonly ShapeData[];
	getShape(id: string): ShapeData | undefined;
	addShape(shape: ShapeData): void;
	updateShape(id: string, updates: Partial<ShapeData>): void;
	deleteShape(id: string): void;
	/** Assign zIndex to any shapes that don't have one (used after bulk load). */
	ensureZIndex(): void;

	getSelection(): ReadonlySet<string>;
	setSelection(ids: string[]): void;
	addToSelection(id: string): void;
	removeFromSelection(id: string): void;
	clearSelection(): void;

	getActiveToolId(): string;
	setActiveToolId(id: string): void;
	getDefaultToolId(): string;
	setDefaultToolId(id: string): void;
	resetToDefaultTool(): void;

	getViewport(): Viewport;
	setViewport(viewport: Viewport): void;
	panBy(dx: number, dy: number): void;
	zoomTo(zoom: number, center: Point): void;
	/**
	 * Center the viewport so that `bounds` fits within a rectangle of
	 * `viewportSize` (in CSS pixels), leaving `padding` pixels on each side.
	 * `bounds` is in world coordinates.
	 */
	fitToBounds(
		bounds: BoundingBox,
		viewportSize: { width: number; height: number },
		padding?: number,
	): void;

	getStyleSettings(): ShapeStyle;
	setStyleSettings(style: Partial<ShapeStyle>): void;

	/** Return shape IDs whose bounds intersect the given world-space viewport. */
	getVisibleShapeIds(viewportBounds: BoundingBox): string[];

	subscribe(listener: () => void): () => void;
	onMutation(listener: (event: StoreEvent) => void): () => void;
}

// ── Plugin ──

export interface PluginContext {
	store: BoardStore;
	layers: LayerManager;
	tools: ToolRegistry;
	shapes: ShapeRegistry;
	commands: CommandRegistry;
	shortcuts: ShortcutRegistry;
	events: EventBus;
	transient: TransientRegistry;
	lod: LodController;
	ui: UiRegistry;
	externalContent: ExternalContentRegistry;
}

/**
 * Cleanup function returned from {@link UsketchPlugin.setup}.
 *
 * Called by `createApp().destroy()` (and as part of setup-rollback when a later
 * plugin throws). May be sync or async — `destroy()` itself stays sync and any
 * async teardown is fire-and-forget with errors logged.
 */
export type PluginTeardown = () => void | Promise<void>;

export interface UsketchPlugin {
	readonly id: string;
	readonly name: string;
	/**
	 * Initialize the plugin. Return a teardown function to release resources
	 * when the app is destroyed; return `void` (or omit a return) if the plugin
	 * has nothing to clean up.
	 *
	 * The previous `plugin.teardown` property has been removed: stashing the
	 * cleanup on `this` is unsafe under React StrictMode (a second `setup` call
	 * silently overwrites the first plugin instance's teardown closure). Always
	 * return the cleanup from setup instead — each `createApp` call owns its
	 * own closure.
	 */
	setup(ctx: PluginContext): PluginTeardown | void | Promise<PluginTeardown | void>;
}
