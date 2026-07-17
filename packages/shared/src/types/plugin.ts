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
	/**
	 * Id of the shape currently hovered (cursor over it), or `null`. Lets a
	 * custom {@link SelectionForeground} adapt the hover indicator per shape type
	 * — the hover counterpart to {@link selection}. Sourced from
	 * {@link BoardStore.getHoveredShapeId}: set by the active tool (the select
	 * tool tracks it on pointer move); `null` when no tool sets it.
	 */
	hoveredShapeId: string | null;
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
	/**
	 * Whether the shape can be resized by the user. Default: `true`.
	 *
	 * Accepts a predicate `(data) => boolean` so a single shape type can vary
	 * resizability per instance (e.g. a `card` type whose `meta.cardType`
	 * decides it). Use {@link isShapeResizable} to evaluate it.
	 */
	resizable?: boolean | ((data: ShapeData) => boolean);
	/**
	 * Container behavior for shapes with children (shapes referencing this shape
	 * via `parentId`).
	 *
	 * Which behaviors are active depends on what's registered:
	 * - **Selection resolution + move-follow** are native — `tool-helpers` /
	 *   `tool-select` read these flags directly, no extra plugin needed.
	 * - **`autoAttach` and `layout`** are driven by `@edv4h/usketch-plugin-container`;
	 *   without it, declaring them has no effect.
	 * - **Snap exclusion** of following children additionally requires
	 *   `@edv4h/usketch-plugin-snap` (the container plugin configures it).
	 *
	 * Colocated with the definition like {@link resizable} / {@link move}, and
	 * each sub-field accepts the same `boolean | (data) => boolean` predicate
	 * form so a single shape type can vary per instance (e.g. a `wireframe`
	 * type whose `meta.component === "card"` is a container). Evaluate via
	 * {@link isShapeContainer} / {@link hasSelectableChildren} /
	 * {@link getContainerLayout}. Omit for non-container shapes.
	 */
	container?: {
		/**
		 * Whether this instance acts as a container. Default: `true` (specifying
		 * `container` at all opts in). Use a predicate for per-instance control.
		 */
		enabled?: boolean | ((data: ShapeData) => boolean);
		/**
		 * Whether children can be selected / resized individually. Default:
		 * `false` (group behavior — clicking a child selects the whole container).
		 * `true` gives frame/island behavior (clicking a child, or marquee over
		 * it, selects the child itself). Only consulted when the shape is an
		 * enabled container.
		 */
		selectableChildren?: boolean | ((data: ShapeData) => boolean);
		/**
		 * Whether a shape dropped/dragged fully inside this container is
		 * automatically attached as its child (`parentId` set), and detached when
		 * moved out. Default: `false` — containers like `group` (explicit) and
		 * `island` (proximity-based) manage membership themselves, so only
		 * containers that opt in (e.g. `frame`, or a custom card) auto-attach on
		 * overlap. Evaluate via {@link isContainerAutoAttach}.
		 */
		autoAttach?: boolean | ((data: ShapeData) => boolean);
		/**
		 * Arrange the container's children (shapes referencing it via `parentId`).
		 * Invoked by the container plugin on attach/detach, container move/resize,
		 * and child add. Returns the patches to apply to each child. Omit for
		 * free positioning (no auto-layout).
		 */
		layout?: (ctx: {
			container: ShapeData;
			children: ShapeData[];
		}) => Array<{ id: string; patch: Partial<ShapeData> }>;
	};
	/**
	 * Child-side "attachable" behavior — the counterpart to {@link ShapeDefinition.container}.
	 * Whereas `container` opts a **parent** in to accepting/holding children, `attachable`
	 * opts this shape in as a **child** that sticks to and follows *any* shape it is dropped
	 * on, regardless of whether that target declared `container`. Use it for stamps, badges,
	 * reaction pins, or handwritten annotation widgets.
	 *
	 * Which behaviors are active mirrors the `container` split (see that field):
	 * - **`follow`** is native — `tool-helpers`/`tool-select` read it directly so this child
	 *   follows a dragged parent even when the parent is not a container. No extra plugin.
	 * - **`toAny` / `hitTest`** (auto-attach on drop) are driven by `createAttachablePlugin()`
	 *   from `@edv4h/usketch-plugin-container`; without it, declaring them has no effect (the
	 *   shape still renders and can be attached programmatically via `parentId`).
	 *
	 * Each sub-field accepts the same `boolean | (data) => boolean` predicate form as
	 * `container`. Evaluate via {@link isAttachable} / {@link isAttachableFollow} /
	 * {@link getAttachableHitTest} / {@link attachableAcceptsTarget}. Omit for shapes that
	 * never auto-attach. A shape may declare both `container` and `attachable`.
	 */
	attachable?: {
		/**
		 * Whether this shape attaches (sets its `parentId`) to a shape it is dropped on /
		 * overlaps. Default: `true` (specifying `attachable` opts in). Pass a predicate
		 * `(target) => boolean` to restrict eligible targets — e.g. exclude connectors or
		 * only stick to certain types. Evaluated per candidate target via
		 * {@link attachableAcceptsTarget}.
		 */
		toAny?: boolean | ((target: ShapeData) => boolean);
		/**
		 * Whether this child follows its parent's move even when the parent is not a
		 * container. Default: `true` (attaching without following is rarely useful). Use a
		 * predicate for per-instance control. Consumed natively by move-follow.
		 */
		follow?: boolean | ((data: ShapeData) => boolean);
		/**
		 * How the attach target is detected on drop. `"center"` (default) attaches when the
		 * child's center point lands inside a target's bounds ("drop it on and it sticks");
		 * `"contain"` requires the child to be fully contained by the target (like
		 * `container.autoAttach`).
		 */
		hitTest?: "center" | "contain";
	};
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

// ── Action System ──

/**
 * A single input to a {@link PluginAction}. A generic UI (e.g. the control HUD)
 * renders an appropriate control per `type` and passes the collected value to
 * `run` under `name`.
 */
export interface ActionParam {
	name: string;
	label?: string;
	type: "string" | "number" | "boolean" | "color" | "enum";
	/** For `type: "enum"` — the selectable options. */
	options?: { value: string; label: string }[];
	/** Initial value shown by the control. */
	default?: string | number | boolean;
	/** For `type: "number"`. */
	min?: number;
	max?: number;
	step?: number;
}

/**
 * A declarative, invokable plugin operation. Plugins register these via
 * {@link ActionRegistry} so a generic control surface (the Debug/Control HUD,
 * and optionally a command palette) can list and invoke them without any
 * plugin-specific UI. `run` typically closes over the plugin's `setup` context.
 */
export interface PluginAction {
	/** Unique id (namespaced, e.g. `freedraw:set-color`). */
	id: string;
	/** Human-readable label for the control. */
	label: string;
	/** Optional grouping key for the UI (e.g. "Freedraw", "Card"). */
	group?: string;
	/** Optional icon component. */
	icon?: () => ReactElement;
	/** Sort order within a group. Lower first. */
	order?: number;
	/** Inputs the action takes; omit for a parameterless button. */
	params?: ActionParam[];
	/** Perform the operation. `args` holds collected {@link ActionParam} values by `name`. */
	run(args: Record<string, unknown>): void | Promise<void>;
	/** Toggle-like state for the UI to reflect (e.g. eraser on). */
	isActive?(): boolean;
	/** Whether the action can currently run (e.g. requires a selection). Default: enabled. */
	isEnabled?(): boolean;
}

/**
 * Registry of {@link PluginAction}s. Mirrors {@link ToolRegistry}'s enumerable
 * `getAll()`/`getOrdered()` shape so a generic UI can list actions, plus
 * `subscribe` so the UI re-renders when plugins register/unregister at runtime.
 */
export interface ActionRegistry {
	register(action: PluginAction): () => void;
	unregister(id: string): void;
	get(id: string): PluginAction | undefined;
	getAll(): ReadonlyMap<string, PluginAction>;
	/** Actions sorted by `group` then `order` then registration order. */
	getOrdered(): readonly { id: string; action: PluginAction }[];
	subscribe(listener: () => void): () => void;
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

/**
 * 単一シェイプ変更の前後スナップショット。`shape:updated` で配信され、
 * 追従系（親の移動に子を追従させる等）が自前で前回位置を保持しなくても
 * `after - before` の差分を直接得られるようにする。
 */
export interface ShapeChange {
	id: string;
	before: ShapeData;
	after: ShapeData;
}

/**
 * `store.onMutation` で配信されるイベント。`store` が発行する**閉じた**判別ユニオンで、
 * `event.type` で絞り込むと `payload` が正しく型付けされる（オープンな文字列フォールバックは
 * 持たない — それを混ぜると `"shape:updated"` も `string` に代入可能なため narrowing が
 * 効かなくなる）。
 *
 * シェイプ系の `payload` は `ids: string[]` に正規化（単一変更でも長さ1）。後方互換のため
 * `id` も併載。`shape:updated` は `before` / `after` を持ち、追従系が自前で前回位置を保持
 * しなくても差分を取れる。
 */
export type StoreEvent =
	| { type: "shape:added"; payload: { id: string; ids: string[] } }
	| { type: "shape:removed"; payload: { id: string; ids: string[] } }
	| { type: "shape:updated"; payload: ShapeChange & { ids: string[] } }
	| { type: "selection:changed"; payload?: { ids: string[] } }
	| { type: "tool:changed"; payload: { id: string } }
	| { type: "default-tool:changed"; payload: { id: string } }
	| { type: "shapes:z-index-initialized"; payload: { count: number } }
	| { type: "viewport:changed"; payload?: undefined }
	| { type: "style:changed"; payload?: undefined };

/** {@link StoreEvent} の `type` リテラル。store の `notifyMutation` で使用。 */
export type StoreEventType = StoreEvent["type"];

export interface BoardStore {
	getShapes(): ReadonlyMap<string, ShapeData>;
	/** Return shapes sorted by zIndex (ascending = back to front). Cached internally. */
	getShapesSorted(): readonly ShapeData[];
	getShape(id: string): ShapeData | undefined;
	addShape(shape: ShapeData): void;
	/** `id` is fixed by the first argument and cannot be changed via `updates`. */
	updateShape(id: string, updates: Partial<Omit<ShapeData, "id">>): void;
	deleteShape(id: string): void;
	/** Assign zIndex to any shapes that don't have one (used after bulk load). */
	ensureZIndex(): void;

	getSelection(): ReadonlySet<string>;
	setSelection(ids: string[]): void;
	addToSelection(id: string): void;
	removeFromSelection(id: string): void;
	clearSelection(): void;

	/**
	 * Id of the shape currently hovered (cursor over it), or `null`. A UI signal
	 * owned by the store (like {@link getSelection}) so overlays and custom
	 * selection foregrounds can react to hover via {@link subscribe} +
	 * {@link LayerRenderContext.hoveredShapeId}. Set by the active tool (the
	 * select tool tracks it on pointer move); tools that don't track hover leave
	 * it `null`.
	 */
	getHoveredShapeId(): string | null;
	setHoveredShapeId(id: string | null): void;

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

// ── Markdown → Shape conversion ──

/**
 * A parsed Markdown (mdast) node handed to converters. Loosely typed so
 * `@edv4h/usketch-shared` needn't depend on mdast; converters narrow by `type`.
 */
export interface MarkdownNode {
	type: string;
	/** Source offsets (mdast `position`) — use with the source to slice raw text. */
	position?: {
		start: { offset?: number };
		end: { offset?: number };
	};
	children?: MarkdownNode[];
	[key: string]: unknown;
}

/**
 * A shape to create from a Markdown node, minus engine-managed fields
 * (`id`/`x`/`y`/`zIndex` are assigned by the orchestrator during layout).
 * Carries the target `type` plus that shape's intrinsic fields (e.g. `text`,
 * `fontSize`, or `meta`).
 */
export interface MarkdownShapeSpec {
	type: string;
	/**
	 * Absolute id/position — set by self-laying-out converters (e.g. a mermaid
	 * flowchart emitting interconnected nodes). When omitted the orchestrator
	 * assigns an id and stacks the shape in the current vertical slot.
	 */
	id?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	style?: Partial<ShapeStyle>;
	meta?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface MarkdownConverterContext {
	/** The full original Markdown source (slice with `node.position` offsets). */
	source: string;
	shapes: ShapeRegistry;
	/**
	 * Top-left of the current layout slot. Self-laying-out converters position
	 * their shapes (and any connector endpoints) absolutely from here; simple
	 * single-shape converters can ignore it and let the orchestrator place them.
	 */
	origin: { x: number; y: number };
}

export interface MarkdownConverter {
	id: string;
	/** mdast node types this handles (e.g. `["heading","paragraph"]`). */
	nodeTypes?: string[];
	/** Extra predicate, ANDed with `nodeTypes` when both are given. */
	match?: (node: MarkdownNode) => boolean;
	/** Higher wins; ties resolve to the most-recently-registered. Default 0. */
	order?: number;
	convert(node: MarkdownNode, ctx: MarkdownConverterContext): MarkdownShapeSpec[];
}

export interface MarkdownConverterRegistry {
	/** Register a converter (re-registering an `id` replaces + bumps it). Returns an unsubscribe. */
	register(converter: MarkdownConverter): () => void;
	unregister(id: string): void;
	/** Best converter for a node (type/match filter → highest order → last), or undefined. */
	resolve(node: MarkdownNode): MarkdownConverter | undefined;
	/** All registered converters (insertion order). */
	getAll(): readonly MarkdownConverter[];
}

/**
 * Generic, string-keyed slot for plugin-provided services — the extension point
 * for capabilities the engine kernel doesn't itself use but that one plugin
 * exposes for others to consume. It's an IoC rendezvous by key: a consumer need
 * not import the provider's package. It is a synchronous map, not a lifecycle —
 * a consumer that reads a service during its own `setup()` must be registered
 * *after* the providing plugin (or tolerate the service being absent). A
 * providing plugin owns the service's lifetime. Prefer a typed accessor exported
 * alongside the key (e.g. `getMarkdownConverters(ctx)`) over `get` with an
 * inline type.
 */
export interface ServiceRegistry {
	/** Provide a service under `key`; re-providing replaces. Returns an unprovide fn. */
	provide<T>(key: string, service: T): () => void;
	/** The service provided under `key`, or undefined if none is registered. */
	get<T>(key: string): T | undefined;
	/** Whether a service is currently provided under `key`. */
	has(key: string): boolean;
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
	/** Declarative, enumerable plugin operations surfaced by the control HUD. */
	actions: ActionRegistry;
	/**
	 * String-keyed registry for plugin-provided services (IoC). Feature-specific
	 * registries — e.g. the Markdown-converter registry — live here rather than
	 * as dedicated kernel fields, so the core contract stays free of single-
	 * feature concerns. See {@link ServiceRegistry}.
	 */
	services: ServiceRegistry;
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
	// biome-ignore lint/suspicious/noConfusingVoidType: setup はティアダウン関数 or 何も返さない(void)を許容する意図的な union
	setup(ctx: PluginContext): PluginTeardown | void | Promise<PluginTeardown | void>;
}
