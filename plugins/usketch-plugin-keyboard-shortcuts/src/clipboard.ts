import {
	type BoardStore,
	type BoundingBox,
	type CommandRegistry,
	type EventBus,
	getRotatedAABB,
	type ShapeData,
	type ShapeRegistry,
	safeRotation,
} from "@edv4h/usketch-shared";
import {
	cloneShapes,
	collectWithDescendants,
	connectorsBetween,
	createAddShapesCommand,
	rootShapeIds,
	translateShape,
} from "@edv4h/usketch-store";

const PASTE_OFFSET = 20;
const CLIPBOARD_FORMAT = "usketch/shapes";

/** Fallback storage when navigator.clipboard is unavailable */
interface ClipboardContent {
	shapes: ShapeData[];
	/** Shapes to select after pasting (the copied selection, without auto-added connectors). */
	selectedIds?: string[];
}

let inMemoryClipboard: ClipboardContent | null = null;

function isInputFocused(): boolean {
	const el = document.activeElement;
	if (!el) return false;
	const tag = el.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

/**
 * 選択中の shape とその子孫（frame / group の中身）、およびそれらを結ぶコネクタ。
 * `selectedIds` は複製後に選択し直す起点（選択中の shape のうち親が含まれないもの）で、
 * 自動で足したコネクタは含めない。
 */
function collectShapes(store: BoardStore): { shapes: ShapeData[]; selectedIds: string[] } {
	const shapes = collectWithDescendants(store, store.getSelection());
	return {
		shapes: [
			...shapes,
			...connectorsBetween(
				store,
				shapes.map((s) => s.id),
			),
		],
		selectedIds: rootShapeIds(shapes),
	};
}

/**
 * 新規 shape 群（新 id・親子/接続の張り替え・初期 +20 オフセット）を生成。`newIds` は
 * 確定後に選択する id で、`selectedIds`（複製元で選択されていたもの）の複製先。
 */
function cloneWithNewIds(
	shapes: ShapeData[],
	selectedIds: readonly string[] | undefined,
	registry?: ShapeRegistry,
): { newShapes: ShapeData[]; newIds: string[] } {
	const { shapes: newShapes, idMap } = cloneShapes(shapes, {
		dx: PASTE_OFFSET,
		dy: PASTE_OFFSET,
		registry,
	});
	const newIds = selectedIds
		? selectedIds.flatMap((id) => {
				const mapped = idMap.get(id);
				return mapped ? [mapped] : [];
			})
		: rootShapeIds(newShapes);
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
	commands.execute(createAddShapesCommand(store, placed));
	store.setSelection(newIds);
}

export async function copyShapes(store: BoardStore): Promise<void> {
	if (isInputFocused()) return;
	const { shapes, selectedIds } = collectShapes(store);
	if (shapes.length === 0) return;

	inMemoryClipboard = { shapes, selectedIds };

	try {
		await navigator.clipboard.writeText(
			JSON.stringify({ format: CLIPBOARD_FORMAT, shapes, selectedIds }),
		);
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

	let content: ClipboardContent | null = null;

	try {
		const text = await navigator.clipboard.readText();
		const data = JSON.parse(text);
		if (data?.format === CLIPBOARD_FORMAT && Array.isArray(data.shapes)) {
			content = {
				shapes: data.shapes as ShapeData[],
				// Older clipboard data has no selectedIds: fall back to the roots.
				selectedIds: Array.isArray(data.selectedIds) ? (data.selectedIds as string[]) : undefined,
			};
		}
	} catch {
		// Clipboard API failed; fall through to in-memory
	}

	if (!content) content = inMemoryClipboard;
	if (!content || content.shapes.length === 0) return;

	const { newShapes, newIds } = cloneWithNewIds(content.shapes, content.selectedIds, shapeRegistry);
	placeAndCommit(store, commands, events, newShapes, newIds, shapeRegistry);
}

export function duplicateShapes(
	store: BoardStore,
	commands: CommandRegistry,
	events?: EventBus,
	shapeRegistry?: ShapeRegistry,
): void {
	if (isInputFocused()) return;

	const { shapes, selectedIds } = collectShapes(store);
	if (shapes.length === 0) return;

	const { newShapes, newIds } = cloneWithNewIds(shapes, selectedIds, shapeRegistry);
	placeAndCommit(store, commands, events, newShapes, newIds, shapeRegistry);
}
