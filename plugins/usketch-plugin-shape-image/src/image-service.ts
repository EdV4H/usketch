// The image plugin's host-facing API. Operation logic lives in plain functions
// that take the BoardStore (per docs/plugin-system-design.md); the HUD and the
// service only call them.
import {
	type BoardStore,
	type Command,
	type CommandRegistry,
	defineService,
	type ServiceRegistry,
} from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { getImageAspect } from "./image-resize.js";
import type { ImageFit, ImageResizeMode, ImageShapeData } from "./types.js";

type ShapeUpdate = { id: string; from: Partial<ImageShapeData>; to: Partial<ImageShapeData> };

/** The image shapes among `ids` (unknown ids and other shape types are skipped). */
export function getImageShapes(store: BoardStore, ids: Iterable<string>): ImageShapeData[] {
	const out: ImageShapeData[] = [];
	for (const id of ids) {
		const shape = store.getShape(id);
		if (shape?.type === "image") out.push(shape as ImageShapeData);
	}
	return out;
}

function toCommand(store: BoardStore, updates: ShapeUpdate[]): Command | null {
	return updates.length > 0 ? createBatchUpdateShapesCommand(store, updates) : null;
}

/**
 * Undoable command switching the resize mode of the image shapes among `ids`.
 * Switching to `keep-aspect` keeps the current size and, when no ratio is
 * stored yet, locks the current box ratio. Returns `null` when nothing changes.
 */
export function setImageResizeMode(
	store: BoardStore,
	ids: Iterable<string>,
	mode: ImageResizeMode,
): Command | null {
	const updates: ShapeUpdate[] = [];
	for (const shape of getImageShapes(store, ids)) {
		if (shape.resizeMode === mode) continue;
		const from: Partial<ImageShapeData> = { resizeMode: shape.resizeMode };
		const to: Partial<ImageShapeData> = { resizeMode: mode };
		if (mode === "keep-aspect" && shape.aspectRatio === undefined) {
			from.aspectRatio = undefined;
			to.aspectRatio = getImageAspect(shape);
		}
		updates.push({ id: shape.id, from, to });
	}
	return toCommand(store, updates);
}

/** Undoable command setting the bitmap fit of the image shapes among `ids`. */
export function setImageFit(
	store: BoardStore,
	ids: Iterable<string>,
	fit: ImageFit,
): Command | null {
	const updates: ShapeUpdate[] = [];
	for (const shape of getImageShapes(store, ids)) {
		if (shape.fit === fit) continue;
		updates.push({ id: shape.id, from: { fit: shape.fit }, to: { fit } });
	}
	return toCommand(store, updates);
}

/** Image operations bound to a board store and its undo history. */
export interface ImageApi {
	/** Set the resize mode of image shapes (default: the current selection). */
	setResizeMode(mode: ImageResizeMode, ids?: Iterable<string>): void;
	/** Set the bitmap fit of image shapes (default: the current selection). */
	setFit(fit: ImageFit, ids?: Iterable<string>): void;
}

/** Typed service handle for the image API. Provide in `setup`, get via {@link getImageApi}. */
export const imageService = defineService<ImageApi>("usketch-plugin-shape-image");

export function createImageApi(store: BoardStore, commands: CommandRegistry): ImageApi {
	const run = (cmd: Command | null) => {
		if (cmd) commands.execute(cmd);
	};
	return {
		setResizeMode: (mode, ids = store.getSelection()) => run(setImageResizeMode(store, ids, mode)),
		setFit: (fit, ids = store.getSelection()) => run(setImageFit(store, ids, fit)),
	};
}

/** Host accessor: `getImageApi(app.services)?.setResizeMode("free")`. */
export function getImageApi(services: ServiceRegistry): ImageApi | undefined {
	return imageService.get(services);
}
