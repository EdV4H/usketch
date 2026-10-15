import type { BoardStore, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { createUpdateShapeCommand } from "@edv4h/usketch-store";
import {
	isOpenSlideShape,
	type OpenSlideDesign,
	type OpenSlideOverrides,
	type OpenSlideShapeData,
	openSlideTextKey,
} from "./types.js";

type Palette = OpenSlideDesign["palette"];

/**
 * 空のマップは持たない。何も残らなければ `{}` を返す (undefined にすると、Yjs へ写す
 * ホストでキーの削除として伝わらないことがあるため、空オブジェクトで「差し替えなし」を表す)。
 */
function compact(overrides: OpenSlideOverrides): OpenSlideOverrides {
	const next: OpenSlideOverrides = {};
	if (overrides.text && Object.keys(overrides.text).length > 0) next.text = overrides.text;
	if (overrides.palette && Object.keys(overrides.palette).length > 0)
		next.palette = overrides.palette;
	return next;
}

/**
 * 文字の差し替えを反映した overrides を返す。`value` がデッキ側の初期値と同じか null なら
 * 差し替えを消す (デッキ側を直したときにその値が出るように、同じ値は持たない)。
 */
export function withOpenSlideText(
	overrides: OpenSlideOverrides | undefined,
	page: number,
	id: string,
	value: string | null,
	defaultValue: string,
): OpenSlideOverrides {
	const key = openSlideTextKey(page, id);
	const text = { ...overrides?.text };
	if (value === null || value === defaultValue) delete text[key];
	else text[key] = value;
	return compact({ ...overrides, text });
}

/** 配色の差し替えを反映した overrides を返す。値が null の色はデッキ側に戻す。 */
export function withOpenSlidePalette(
	overrides: OpenSlideOverrides | undefined,
	palette: { [K in keyof Palette]?: string | null },
): OpenSlideOverrides {
	const next: Partial<Palette> = { ...overrides?.palette };
	for (const key of Object.keys(palette) as (keyof Palette)[]) {
		const value = palette[key];
		if (value === null || value === undefined) delete next[key];
		else next[key] = value;
	}
	return compact({ ...overrides, palette: next });
}

/** デッキの design に配色の差し替えを重ねる。 */
export function resolveOpenSlideDesign(
	design: OpenSlideDesign | undefined,
	overrides: OpenSlideOverrides | undefined,
): OpenSlideDesign | undefined {
	if (!design || !overrides?.palette) return design;
	return { ...design, palette: { ...design.palette, ...overrides.palette } };
}

function updateOverrides(
	store: BoardStore,
	commands: CommandRegistry,
	shapeId: string,
	next: (shape: OpenSlideShapeData) => OpenSlideOverrides,
): void {
	const shape = store.getShape(shapeId);
	if (!shape || !isOpenSlideShape(shape)) return;
	const overrides = next(shape);
	if (JSON.stringify(overrides) === JSON.stringify(shape.overrides ?? {})) return;
	commands.execute(
		createUpdateShapeCommand(
			store,
			shapeId,
			{ overrides: shape.overrides ?? {} } as Partial<ShapeData>,
			{ overrides } as Partial<ShapeData>,
		),
	);
}

/** デッキ Shape の文字を差し替える（undo 可）。 */
export function setOpenSlideText(
	store: BoardStore,
	commands: CommandRegistry,
	shapeId: string,
	params: { page: number; id: string; value: string | null; defaultValue: string },
): void {
	updateOverrides(store, commands, shapeId, (shape) =>
		withOpenSlideText(shape.overrides, params.page, params.id, params.value, params.defaultValue),
	);
}

/** デッキ Shape の配色を差し替える（undo 可）。null の色はデッキ側に戻す。 */
export function setOpenSlidePalette(
	store: BoardStore,
	commands: CommandRegistry,
	shapeId: string,
	palette: { [K in keyof Palette]?: string | null },
): void {
	updateOverrides(store, commands, shapeId, (shape) =>
		withOpenSlidePalette(shape.overrides, palette),
	);
}

/** デッキ Shape の差し替えをすべて消し、デッキ側の内容に戻す（undo 可）。 */
export function resetOpenSlideOverrides(
	store: BoardStore,
	commands: CommandRegistry,
	shapeId: string,
): void {
	updateOverrides(store, commands, shapeId, () => ({}));
}
