import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";

/** Minimal BoardStore implementation for unit tests (no @edv4h/usketch-store dep). */
export function createTestStore(): BoardStore {
	const shapes = new Map<string, ShapeData>();
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
		getSelection: () => new Set<string>(),
		setSelection() {},
		addToSelection() {},
		removeFromSelection() {},
		clearSelection() {},
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
	};
}
