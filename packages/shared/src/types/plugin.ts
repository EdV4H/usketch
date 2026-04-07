import type { ReactElement } from "react";
import type { BoundingBox, Point, Viewport } from "./geometry.js";
import type { ResizeHandle, ShapeData, ShapeStyle } from "./shape.js";
import type { Theme } from "./theme.js";

// ── Layer System ──

export interface LayerRenderContext {
	viewport: Viewport;
	shapes: ReadonlyMap<string, ShapeData>;
	selection: ReadonlySet<string>;
	theme: Theme;
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

// ── Shape System ──

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
}

export interface UsketchPlugin {
	readonly id: string;
	readonly name: string;
	setup(ctx: PluginContext): void | Promise<void>;
	teardown?(): void;
}
