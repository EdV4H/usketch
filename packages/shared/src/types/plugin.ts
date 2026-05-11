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
}

export interface UsketchPlugin {
	readonly id: string;
	readonly name: string;
	setup(ctx: PluginContext): void | Promise<void>;
	teardown?(): void;
}
