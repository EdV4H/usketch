import {
	compareZIndex,
	rotatePoint,
	type ShapeData,
	safeRotation,
	wrapDeg,
} from "@edv4h/usketch-shared";
import { defaultZoneAlign, readZoneMeta, type ZoneAlign, type ZoneArrange } from "./zone.js";

/** Spacing for {@link arrangeZone}, in world units. */
export interface ZoneArrangeOptions {
	/** Inner padding of the zone. Default 8. */
	padding?: number;
	/** Gap between cells for `grid`. Default 8. */
	gap?: number;
	/**
	 * Largest step between neighbours for `spread`, as a fraction of a child's
	 * width (they overlap when the zone runs out of room). Default 0.35.
	 */
	spreadStep?: number;
}

type Patch = { id: string; patch: Partial<ShapeData> };

/** Bottom first, like the board draws them. */
function byZ(children: readonly ShapeData[]): ShapeData[] {
	return [...children].sort((a, b) => compareZIndex(a.zIndex, b.zIndex));
}

function moved(child: ShapeData, x: number, y: number): Patch | null {
	return child.x === x && child.y === y ? null : { id: child.id, patch: { x, y } };
}

/** How far a shape is turned, in (-180, 180] (so 360 is 0 and -180 is 180). */
const turnOf = (shape: Pick<ShapeData, "rotation">): number =>
	wrapDeg(safeRotation(shape.rotation));

/** Round off float noise from turning a point, so a child in place gets no patch. */
const tidy = (n: number): number => Math.round(n * 1e6) / 1e6 + 0;

/**
 * Turn the layout of a zone that is turned itself: each child is placed where the
 * unturned layout put it, turned with the zone about the zone's centre, and faces
 * the way the zone faces (a hand across the table reads the right way up for the
 * player sitting there).
 */
function turned(
	zone: ShapeData,
	deg: number,
	children: readonly ShapeData[],
	laid: Patch[],
): Patch[] {
	const at = new Map(laid.map((p) => [p.id, p.patch]));
	const centre = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
	const rad = (deg * Math.PI) / 180;
	const out: Patch[] = [];
	for (const child of children) {
		const local = at.get(child.id);
		const lx = local?.x ?? child.x;
		const ly = local?.y ?? child.y;
		const c = rotatePoint({ x: lx + child.width / 2, y: ly + child.height / 2 }, centre, rad);
		const x = tidy(c.x - child.width / 2);
		const y = tidy(c.y - child.height / 2);
		const patch: Partial<ShapeData> = {};
		if (child.x !== x) patch.x = x;
		if (child.y !== y) patch.y = y;
		if (turnOf(child) !== deg) patch.rotation = deg;
		if (Object.keys(patch).length > 0) out.push({ id: child.id, patch });
	}
	return out;
}

/**
 * Where a zone puts what it holds: patches that move each child into place.
 * Pure: reads the zone's `arrange` and `align` from its meta and the children
 * as given (sorted by zIndex, bottom first). Children already in place get no patch.
 *
 * A turned zone lays out along its own edges, and its children turn with it: every
 * arrangement but `free` keeps them facing the way the zone faces. An unturned zone
 * leaves its children's own turn alone (a card turned on its own stays turned).
 */
export function arrangeZone(
	zone: ShapeData,
	children: readonly ShapeData[],
	options: ZoneArrangeOptions = {},
): Patch[] {
	const { arrange, align } = readZoneMeta(zone);
	return arrangeBy(arrange, zone, children, options, align);
}

export function arrangeBy(
	arrange: ZoneArrange,
	zone: ShapeData,
	children: readonly ShapeData[],
	options: ZoneArrangeOptions = {},
	align: ZoneAlign = defaultZoneAlign(arrange),
): Patch[] {
	if (arrange === "free") return [];
	const deg = turnOf(zone);
	if (deg === 0) return arrangeUpright(arrange, zone, children, options, align);
	// Lay out as if nothing were turned, then turn it all with the zone.
	return turned(zone, deg, children, arrangeUpright(arrange, zone, children, options, align));
}

function arrangeUpright(
	arrange: ZoneArrange,
	zone: ShapeData,
	children: readonly ShapeData[],
	options: ZoneArrangeOptions,
	align: ZoneAlign,
): Patch[] {
	const { padding = 8, gap = 8, spreadStep = 0.35 } = options;
	// Left edge of a run `width` wide, leaning to `align` inside the padding.
	const leftOf = (width: number): number => {
		if (align === "start") return zone.x + padding;
		if (align === "end") return zone.x + zone.width - padding - width;
		return zone.x + zone.width / 2 - width / 2;
	};
	const sorted = byZ(children);
	const out: Patch[] = [];
	const push = (p: Patch | null) => {
		if (p) out.push(p);
	};
	const cy = zone.y + zone.height / 2;

	switch (arrange) {
		case "free":
			return [];
		case "pile":
			for (const child of sorted) push(moved(child, leftOf(child.width), cy - child.height / 2));
			return out;
		case "spread": {
			const n = sorted.length;
			if (n === 0) return out;
			const widths = sorted.map((c) => c.width);
			const last = widths[n - 1] ?? 0;
			const inner = zone.width - padding * 2;
			const widest = Math.max(...widths);
			// Step between left edges: as wide as the zone allows, at most spreadStep of a card.
			const maxStep = widest * spreadStep;
			const room = n > 1 ? Math.max(0, (inner - last) / (n - 1)) : 0;
			const step = Math.min(maxStep, room);
			const total = step * (n - 1) + last;
			// Leaning to `align` (centered overflows evenly when even step 0 doesn't fit).
			let x = leftOf(total);
			for (const child of sorted) {
				push(moved(child, x, cy - child.height / 2));
				x += step;
			}
			return out;
		}
		case "grid": {
			const first = sorted[0];
			if (!first) return out;
			const cellW = Math.max(...sorted.map((c) => c.width));
			const cellH = Math.max(...sorted.map((c) => c.height));
			const inner = zone.width - padding * 2;
			const cols = Math.max(1, Math.floor((inner + gap) / (cellW + gap)));
			// Each row leans to `align` on its own (a short last row too).
			const rowLeft = (row: number): number => {
				const inRow = Math.min(cols, sorted.length - row * cols);
				return leftOf(inRow * cellW + (inRow - 1) * gap);
			};
			sorted.forEach((child, i) => {
				const col = i % cols;
				const row = Math.floor(i / cols);
				push(
					moved(
						child,
						rowLeft(row) + col * (cellW + gap) + (cellW - child.width) / 2,
						zone.y + padding + row * (cellH + gap) + (cellH - child.height) / 2,
					),
				);
			});
			return out;
		}
	}
}
