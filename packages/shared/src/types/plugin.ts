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

export interface Layer {
	id: string;
	order: number;
	render: (ctx: LayerRenderContext) => ReactElement | null;
	interactable?: boolean;
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
	button: number;
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
}

// ── Shortcut System ──

export interface ShortcutRegistry {
	register(combo: string, callback: () => void): () => void;
	handleKeyDown(event: KeyboardEvent): boolean;
}

// ── Event Bus ──

export interface EventBus {
	on<T = unknown>(event: string, handler: (data: T) => void): () => void;
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
	emit(obj: TransientObject): void;
	dismiss(id: string): void;
	getAll(): ReadonlyMap<string, TransientObject>;
}

// ── Store ──

export interface BoardStore {
	getShapes(): ReadonlyMap<string, ShapeData>;
	getShape(id: string): ShapeData | undefined;
	addShape(shape: ShapeData): void;
	updateShape(id: string, updates: Partial<ShapeData>): void;
	deleteShape(id: string): void;

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

	subscribe(listener: () => void): () => void;
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
	readonly type: "tool" | "shape" | "background" | "feature";
	setup(ctx: PluginContext): void | Promise<void>;
	teardown?(): void;
}
