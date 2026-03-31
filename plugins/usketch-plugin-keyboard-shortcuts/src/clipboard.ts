import {
	type BoardStore,
	type CommandRegistry,
	generateId,
	type ShapeData,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";

const PASTE_OFFSET = 20;
const CLIPBOARD_FORMAT = "usketch/shapes";

/** Fallback storage when navigator.clipboard is unavailable */
let inMemoryClipboard: ShapeData[] | null = null;

function isInputFocused(): boolean {
	const el = document.activeElement;
	if (!el) return false;
	const tag = el.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

function collectShapes(store: BoardStore): ShapeData[] {
	const selection = store.getSelection();
	if (selection.size === 0) return [];
	const shapes: ShapeData[] = [];
	for (const id of selection) {
		const shape = store.getShape(id);
		if (shape) shapes.push({ ...shape });
	}
	return shapes;
}

export async function copyShapes(store: BoardStore): Promise<void> {
	if (isInputFocused()) return;
	const shapes = collectShapes(store);
	if (shapes.length === 0) return;

	inMemoryClipboard = shapes;

	try {
		await navigator.clipboard.writeText(JSON.stringify({ format: CLIPBOARD_FORMAT, shapes }));
	} catch {
		// Clipboard API not available; in-memory fallback is already set
	}
}

export async function pasteShapes(store: BoardStore, commands: CommandRegistry): Promise<void> {
	if (isInputFocused()) return;

	let shapes: ShapeData[] | null = null;

	try {
		const text = await navigator.clipboard.readText();
		const data = JSON.parse(text);
		if (data?.format === CLIPBOARD_FORMAT && Array.isArray(data.shapes)) {
			shapes = data.shapes as ShapeData[];
		}
	} catch {
		// Clipboard API failed; fall through to in-memory
	}

	if (!shapes) {
		shapes = inMemoryClipboard;
	}

	if (!shapes || shapes.length === 0) return;

	const newIds: string[] = [];
	const idMap = new Map<string, string>();

	// Generate new IDs first
	for (const shape of shapes) {
		const newId = generateId();
		idMap.set(shape.id, newId);
		newIds.push(newId);
	}

	for (const shape of shapes) {
		const newId = idMap.get(shape.id) ?? shape.id;
		const parentId =
			shape.parentId && idMap.has(shape.parentId as string)
				? idMap.get(shape.parentId as string)
				: undefined;

		const newShape: ShapeData = {
			...shape,
			id: newId,
			x: shape.x + PASTE_OFFSET,
			y: shape.y + PASTE_OFFSET,
			...(parentId !== undefined ? { parentId } : {}),
		};
		commands.execute(createAddShapeCommand(store, newShape));
	}

	store.setSelection(newIds);
}

export function duplicateShapes(store: BoardStore, commands: CommandRegistry): void {
	if (isInputFocused()) return;

	const shapes = collectShapes(store);
	if (shapes.length === 0) return;

	const newIds: string[] = [];
	const idMap = new Map<string, string>();

	for (const shape of shapes) {
		const newId = generateId();
		idMap.set(shape.id, newId);
		newIds.push(newId);
	}

	for (const shape of shapes) {
		const newId = idMap.get(shape.id) ?? shape.id;
		const parentId =
			shape.parentId && idMap.has(shape.parentId as string)
				? idMap.get(shape.parentId as string)
				: undefined;

		const newShape: ShapeData = {
			...shape,
			id: newId,
			x: shape.x + PASTE_OFFSET,
			y: shape.y + PASTE_OFFSET,
			...(parentId !== undefined ? { parentId } : {}),
		};
		commands.execute(createAddShapeCommand(store, newShape));
	}

	store.setSelection(newIds);
}
