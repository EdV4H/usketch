import {
	type BoardStore,
	type BoundingBox,
	type CommandRegistry,
	type EventBus,
	generateId,
	getRotatedAABB,
	type ShapeData,
	type ShapeRegistry,
	safeRotation,
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

/**
 * shape を (dx, dy) 平行移動する。`ShapeDefinition.move`（コネクタの endpoints など
 * 絶対座標フィールドも動かす）があればそれを使い、無ければ x/y のみ更新する。
 */
function translateShape(
	shape: ShapeData,
	dx: number,
	dy: number,
	registry?: ShapeRegistry,
): ShapeData {
	const move = registry?.get(shape.type)?.move;
	if (move) return { ...shape, ...move(shape, dx, dy) };
	return { ...shape, x: shape.x + dx, y: shape.y + dy };
}

/** 新規 shape 群（新 id・親子の付け替え・初期 +20 オフセット）を生成。 */
function cloneWithNewIds(
	shapes: ShapeData[],
	registry?: ShapeRegistry,
): { newShapes: ShapeData[]; newIds: string[] } {
	const idMap = new Map<string, string>();
	const newIds: string[] = [];
	for (const shape of shapes) {
		const newId = generateId();
		idMap.set(shape.id, newId);
		newIds.push(newId);
	}
	const newShapes = shapes.map((shape) => {
		const newId = idMap.get(shape.id) ?? shape.id;
		const parentId =
			shape.parentId && idMap.has(shape.parentId as string)
				? idMap.get(shape.parentId as string)
				: undefined;
		return {
			...translateShape(shape, PASTE_OFFSET, PASTE_OFFSET, registry),
			id: newId,
			...(parentId !== undefined ? { parentId } : {}),
		} as ShapeData;
	});
	return { newShapes, newIds };
}

/**
 * shape の footprint を回転考慮 AABB で返す。free-position プラグインの occupied 収集と
 * 完全に揃えるため、registry があれば `ShapeDefinition.getBounds`（connector の矢印/ラベル等で
 * 素の x/y/w/h より大きくなり得る）を用い、無ければ x/y/w/h にフォールバックする。
 */
function shapeAABB(s: ShapeData, registry?: ShapeRegistry): BoundingBox {
	const bounds = registry?.get(s.type)?.getBounds(s) ?? {
		x: s.x,
		y: s.y,
		width: s.width,
		height: s.height,
	};
	const rotation = safeRotation(s.rotation);
	return rotation ? getRotatedAABB(bounds, rotation) : bounds;
}

function groupBounds(shapes: ShapeData[], registry?: ShapeRegistry): BoundingBox {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const s of shapes) {
		const b = shapeAABB(s, registry);
		if (b.x < minX) minX = b.x;
		if (b.y < minY) minY = b.y;
		if (b.x + b.width > maxX) maxX = b.x + b.width;
		if (b.y + b.height > maxY) maxY = b.y + b.height;
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * 新 shape 群を「被らない位置」へグループ単位でずらして確定する。
 * free-position プラグインが居れば `free-position:find` で空き位置を取得（相対配置は維持）。
 * 居なければ従来の `+20` オフセットのまま（graceful degradation）。
 */
function placeAndCommit(
	store: BoardStore,
	commands: CommandRegistry,
	events: EventBus | undefined,
	newShapes: ShapeData[],
	newIds: string[],
	shapeRegistry?: ShapeRegistry,
): void {
	let placed = newShapes;
	if (events && newShapes.length > 0) {
		const desired = groupBounds(newShapes, shapeRegistry);
		// 同期コールバックで結果を受け、グループ全体を delta だけずらす。
		events.emit("free-position:find", {
			desired,
			onResult: (free: BoundingBox) => {
				if (free.x === desired.x && free.y === desired.y) return;
				const dx = free.x - desired.x;
				const dy = free.y - desired.y;
				placed = newShapes.map((s) => translateShape(s, dx, dy, shapeRegistry));
			},
		});
	}
	for (const shape of placed) {
		commands.execute(createAddShapeCommand(store, shape));
	}
	store.setSelection(newIds);
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

export async function pasteShapes(
	store: BoardStore,
	commands: CommandRegistry,
	events?: EventBus,
	shapeRegistry?: ShapeRegistry,
): Promise<void> {
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

	if (!shapes) shapes = inMemoryClipboard;
	if (!shapes || shapes.length === 0) return;

	const { newShapes, newIds } = cloneWithNewIds(shapes, shapeRegistry);
	placeAndCommit(store, commands, events, newShapes, newIds, shapeRegistry);
}

export function duplicateShapes(
	store: BoardStore,
	commands: CommandRegistry,
	events?: EventBus,
	shapeRegistry?: ShapeRegistry,
): void {
	if (isInputFocused()) return;

	const shapes = collectShapes(store);
	if (shapes.length === 0) return;

	const { newShapes, newIds } = cloneWithNewIds(shapes, shapeRegistry);
	placeAndCommit(store, commands, events, newShapes, newIds, shapeRegistry);
}
