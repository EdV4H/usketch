import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";

/** A minimal store over a shapes map that is replaced on every change (like the real one). */
export function fakeStore(initial: ShapeData[] = []): BoardStore & { listeners: Set<() => void> } {
	let shapes = new Map<string, ShapeData>(initial.map((s) => [s.id, s]));
	const listeners = new Set<() => void>();
	const emit = () => {
		for (const l of listeners) l();
	};
	return {
		listeners,
		getShapes: () => shapes,
		getShape: (id: string) => shapes.get(id),
		addShape(shape: ShapeData) {
			shapes = new Map(shapes);
			shapes.set(shape.id, shape);
			emit();
		},
		updateShape(id: string, patch: Partial<ShapeData>) {
			const cur = shapes.get(id);
			if (!cur) return;
			shapes = new Map(shapes);
			shapes.set(id, { ...cur, ...patch } as ShapeData);
			emit();
		},
		deleteShape(id: string) {
			shapes = new Map(shapes);
			shapes.delete(id);
			emit();
		},
		subscribe(l: () => void) {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
	} as unknown as BoardStore & { listeners: Set<() => void> };
}
