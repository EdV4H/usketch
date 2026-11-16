/** World-space rectangle. */
export interface RespondRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ArrangeOptions<T> {
	/** Where to place the items (their top-left starts at the area's top-left + padding). */
	area: RespondRect;
	itemWidth: number;
	itemHeight: number;
	/** Space between items and around the area's edge. Default 16. */
	gap?: number;
	/**
	 * Group items: each group starts on a new row, groups in first-seen order unless
	 * `groupOrder` says otherwise. Items without a group (`undefined`) come last.
	 * Omitted = one grid in the given order.
	 */
	groupOf?: (item: T) => string | undefined;
	/** Preferred order of groups; groups not listed follow in first-seen order. */
	groupOrder?: readonly string[];
}

export interface ArrangedItem<T> {
	item: T;
	x: number;
	y: number;
	/** The group the item was placed in (`undefined` for the ungrouped row). */
	group?: string;
}

/**
 * Lay items out in rows inside an area: as many columns as fit the area's width
 * (at least one). Rows continue below the area when there are more items than
 * fit; the caller can grow the area or zoom out. Pure.
 */
export function arrangeResponses<T>(
	items: readonly T[],
	options: ArrangeOptions<T>,
): ArrangedItem<T>[] {
	const gap = Math.max(0, options.gap ?? 16);
	const { area, itemWidth, itemHeight } = options;
	const columns = Math.max(1, Math.floor((area.width - gap) / (itemWidth + gap)));
	const groups: { key: string | undefined; items: T[] }[] = [];
	if (options.groupOf) {
		const byKey = new Map<string | undefined, T[]>();
		for (const item of items) {
			const key = options.groupOf(item);
			const list = byKey.get(key);
			if (list) list.push(item);
			else byKey.set(key, [item]);
		}
		const order = options.groupOrder ?? [];
		const keys = [...byKey.keys()].filter((k): k is string => k !== undefined);
		keys.sort((a, b) => {
			const ia = order.indexOf(a);
			const ib = order.indexOf(b);
			if (ia >= 0 && ib >= 0) return ia - ib;
			if (ia >= 0) return -1;
			if (ib >= 0) return 1;
			return 0; // stable: first-seen order
		});
		for (const key of keys) groups.push({ key, items: byKey.get(key) ?? [] });
		const loose = byKey.get(undefined);
		if (loose) groups.push({ key: undefined, items: loose });
	} else {
		groups.push({ key: undefined, items: [...items] });
	}

	const placed: ArrangedItem<T>[] = [];
	let row = 0;
	for (const group of groups) {
		group.items.forEach((item, i) => {
			const r = row + Math.floor(i / columns);
			const c = i % columns;
			placed.push({
				item,
				x: area.x + gap + c * (itemWidth + gap),
				y: area.y + gap + r * (itemHeight + gap),
				...(options.groupOf && group.key !== undefined ? { group: group.key } : {}),
			});
		});
		row += Math.ceil(group.items.length / columns);
	}
	return placed;
}
