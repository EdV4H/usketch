import type {
	BoardStore,
	CanvasPointerEvent,
	CommandRegistry,
	EventBus,
	Point,
	ShapeData,
	ShapeDefinition,
	ShapeRegistry,
	ToolContext,
} from "@edv4h/usketch-shared";

/**
 * Minimal BoardStore for unit tests — no `@edv4h/usketch-store` dep, no
 * snap/event plumbing. Any helper-internal call to `updateShape` lands
 * directly on the in-memory map so tests can assert state by reading
 * `store.getShape(id)`.
 */
export function createTestStore(): BoardStore {
	const shapes = new Map<string, ShapeData>();
	const selection = new Set<string>();
	const listeners = new Set<() => void>();
	const mutationListeners = new Set<(event: { type: string; payload?: unknown }) => void>();

	function notify() {
		for (const fn of listeners) fn();
	}
	function notifyMutation(type: string, payload?: unknown) {
		const event = payload !== undefined ? { type, payload } : { type };
		for (const fn of mutationListeners) fn(event);
	}

	return {
		getShapes: () => shapes,
		getShape: (id: string) => shapes.get(id),
		addShape(shape: ShapeData) {
			shapes.set(shape.id, shape);
			notify();
			notifyMutation("shape:added", { id: shape.id });
		},
		updateShape(id: string, updates: Partial<ShapeData>) {
			const existing = shapes.get(id);
			if (!existing) return;
			shapes.set(id, { ...existing, ...updates });
			notify();
			notifyMutation("shape:updated", { id });
		},
		deleteShape(id: string) {
			if (!shapes.has(id)) return;
			shapes.delete(id);
			notify();
			notifyMutation("shape:removed", { id });
		},
		ensureZIndex() {},
		getSelection: () => selection,
		setSelection(ids: Iterable<string>) {
			selection.clear();
			for (const id of ids) selection.add(id);
			notify();
		},
		addToSelection(id: string) {
			selection.add(id);
			notify();
		},
		removeFromSelection(id: string) {
			selection.delete(id);
			notify();
		},
		clearSelection() {
			selection.clear();
			notify();
		},
		getActiveToolId: () => "select",
		setActiveToolId() {},
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
		setViewport() {},
		panBy() {},
		zoomTo() {},
		getStyleSettings: () => ({
			fill: "#ffffff",
			stroke: "#1e1e1e",
			strokeWidth: 2,
			opacity: 1,
		}),
		setStyleSettings() {},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onMutation(listener: (event: { type: string; payload?: unknown }) => void) {
			mutationListeners.add(listener);
			return () => mutationListeners.delete(listener);
		},
	} as unknown as BoardStore;
}

/**
 * Default shape definition map registering only `rect` — sufficient for the
 * helpers' tests. Tools that need other shape types (e.g. line, ellipse)
 * pass their own registry.
 */
export function createTestShapeRegistry(
	overrides: Map<string, ShapeDefinition> = new Map(),
): ShapeRegistry {
	const map = new Map<string, ShapeDefinition>([
		["rect", rectDefinition()],
		["frame", frameDefinition()],
		["group", groupDefinition()],
		["island", islandDefinition()],
		...overrides,
	]);
	return {
		register(type: string, def: ShapeDefinition) {
			map.set(type, def);
		},
		get: (type: string) => map.get(type),
		getAll: () => map,
	} as ShapeRegistry;
}

function rectDefinition(): ShapeDefinition {
	return {
		type: "rect",
		minSize: { width: 1, height: 1 },
		hitTest(data: ShapeData, point: { x: number; y: number }) {
			return (
				point.x >= data.x &&
				point.x <= data.x + data.width &&
				point.y >= data.y &&
				point.y <= data.y + data.height
			);
		},
		getBounds: (data: ShapeData) => ({
			x: data.x,
			y: data.y,
			width: data.width,
			height: data.height,
		}),
		resize(data: ShapeData, _handle: string, delta: { x: number; y: number }) {
			// Minimal resize hook for tests: trust the helper's bounds math.
			return { ...data, width: data.width + delta.x, height: data.height + delta.y };
		},
		render: () => null,
	} as unknown as ShapeDefinition;
}

function frameDefinition(): ShapeDefinition {
	const def = rectDefinition();
	// Matches the real frame plugin: container with individually-selectable children.
	return { ...def, type: "frame", container: { selectableChildren: true } } as ShapeDefinition;
}

function groupDefinition(): ShapeDefinition {
	const def = rectDefinition();
	// Container, but children select the whole group (selectableChildren omitted).
	return { ...def, type: "group", container: {} } as ShapeDefinition;
}

function islandDefinition(): ShapeDefinition {
	const def = rectDefinition();
	return { ...def, type: "island", container: { selectableChildren: true } } as ShapeDefinition;
}

export function createTestCommands(): CommandRegistry & { history: unknown[] } {
	const stack: { execute(): void; undo(): void }[] = [];
	const redoStack: { execute(): void; undo(): void }[] = [];
	const history: unknown[] = [];
	const api = {
		execute(cmd: { execute(): void; undo(): void }) {
			cmd.execute();
			stack.push(cmd);
			redoStack.length = 0;
			history.push(cmd);
		},
		undo() {
			const cmd = stack.pop();
			if (!cmd) return;
			cmd.undo();
			redoStack.push(cmd);
		},
		redo() {
			const cmd = redoStack.pop();
			if (!cmd) return;
			cmd.execute();
			stack.push(cmd);
		},
		canUndo: () => stack.length > 0,
		canRedo: () => redoStack.length > 0,
		getHistorySize: () => stack.length,
		getCursor: () => stack.length,
		clear() {
			stack.length = 0;
			redoStack.length = 0;
		},
		history,
	};
	return api as unknown as CommandRegistry & { history: unknown[] };
}

export function createTestEventBus(): EventBus & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	const listeners = new Map<string, Set<(payload: unknown) => void>>();
	const api = {
		emit(type: string, payload: unknown) {
			emitted.push({ type, payload });
			for (const fn of listeners.get(type) ?? []) fn(payload);
		},
		on(type: string, fn: (payload: unknown) => void) {
			let bucket = listeners.get(type);
			if (!bucket) {
				bucket = new Set();
				listeners.set(type, bucket);
			}
			bucket.add(fn);
			return () => bucket?.delete(fn);
		},
		off(type: string, fn: (payload: unknown) => void) {
			listeners.get(type)?.delete(fn);
		},
		emitted,
	};
	return api as unknown as EventBus & { emitted: Array<{ type: string; payload: unknown }> };
}

export function createTestToolContext(): ToolContext {
	return {
		store: createTestStore(),
		shapes: createTestShapeRegistry(),
		commands: createTestCommands(),
		events: createTestEventBus(),
	};
}

export function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: `shape-${Math.random().toString(36).slice(2, 8)}`,
		type: "rect",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
		...overrides,
	} as ShapeData;
}

export function makePointerEvent(
	worldPoint: Point,
	overrides: Partial<CanvasPointerEvent> = {},
): CanvasPointerEvent {
	return {
		worldPoint,
		screenPoint: worldPoint,
		shiftKey: false,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		button: 0,
		...overrides,
	};
}
