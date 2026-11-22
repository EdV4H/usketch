import { compareZIndex, type ShapeData } from "@edv4h/usketch-shared";
import { readZoneMeta, type ZoneArrange } from "./zone.js";

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

/**
 * Where a zone puts what it holds: patches that move each child into place.
 * Pure: reads the zone's `arrange` from its meta and the children as given
 * (sorted by zIndex, bottom first). Children already in place get no patch.
 */
export function arrangeZone(
	zone: ShapeData,
	children: readonly ShapeData[],
	options: ZoneArrangeOptions = {},
): Patch[] {
	return arrangeBy(readZoneMeta(zone).arrange, zone, children, options);
}

export function arrangeBy(
	arrange: ZoneArrange,
	zone: ShapeData,
	children: readonly ShapeData[],
	options: ZoneArrangeOptions = {},
): Patch[] {
	const { padding = 8, gap = 8, spreadStep = 0.35 } = options;
	const sorted = byZ(children);
	const out: Patch[] = [];
	const push = (p: Patch | null) => {
		if (p) out.push(p);
	};
	const cx = zone.x + zone.width / 2;
	const cy = zone.y + zone.height / 2;

	switch (arrange) {
		case "free":
			return [];
		case "pile":
			for (const child of sorted) push(moved(child, cx - child.width / 2, cy - child.height / 2));
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
			// Centered in the zone (overflowing evenly when even step 0 doesn't fit).
			let x = cx - total / 2;
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
			sorted.forEach((child, i) => {
				const col = i % cols;
				const row = Math.floor(i / cols);
				push(
					moved(
						child,
						zone.x + padding + col * (cellW + gap) + (cellW - child.width) / 2,
						zone.y + padding + row * (cellH + gap) + (cellH - child.height) / 2,
					),
				);
			});
			return out;
		}
	}
}
