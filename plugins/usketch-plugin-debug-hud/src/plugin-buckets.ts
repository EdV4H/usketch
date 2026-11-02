import type {
	ActionRegistry,
	HudPanel,
	HudRegistry,
	HudSettingsDescriptor,
	PluginAction,
	PluginInfoRegistry,
} from "@edv4h/usketch-shared";

/** A plugin's aggregated HUD contributions, rendered as one section. */
export interface PluginBucket {
	pluginId: string;
	name: string;
	settings: HudSettingsDescriptor[];
	/** Actions sub-grouped by `action.group` (insertion order preserved). */
	actionGroups: Map<string, PluginAction[]>;
	panels: HudPanel[];
}

export const UNATTRIBUTED = " unattributed";

function matches(q: string, ...parts: (string | undefined)[]): boolean {
	return parts.some((p) => p?.toLowerCase().includes(q));
}

/** Number of controls in a bucket (shown as a count badge on the section header). */
export function bucketSize(b: PluginBucket): number {
	let n = b.settings.length + b.panels.length;
	for (const items of b.actionGroups.values()) n += items.length;
	return n;
}

/**
 * Assemble one {@link PluginBucket} per plugin that has any control (settings,
 * actions, or custom panels), in plugin-registration order, with unattributed
 * contributions last.
 *
 * `q` (lower-cased) filters contributions: a plugin whose name / id matches
 * keeps **all** its controls; otherwise only actions (label / group / id),
 * settings (label / id / field names & labels) and panels (title / id) that
 * match are kept. Within a plugin, actions keep their `group` as a sub-heading
 * (empty string when ungrouped).
 */
export function buildPluginBuckets(
	actions: ActionRegistry,
	hud: HudRegistry,
	plugins: PluginInfoRegistry,
	q: string,
): PluginBucket[] {
	const order: string[] = [];
	const byId = new Map<string, PluginBucket>();
	const nameOf = new Map(plugins.getAll().map((p) => [p.id, p.name]));

	const bucketFor = (pluginId: string | undefined): PluginBucket => {
		const key = pluginId ?? UNATTRIBUTED;
		let b = byId.get(key);
		if (!b) {
			b = {
				pluginId: key,
				name: pluginId ? (nameOf.get(pluginId) ?? pluginId) : "Other",
				settings: [],
				actionGroups: new Map(),
				panels: [],
			};
			byId.set(key, b);
			order.push(key);
		}
		return b;
	};

	// Seed buckets in plugin-registration order so sections are stably ordered
	// regardless of which contribution type is encountered first below.
	for (const p of plugins.getAll()) bucketFor(p.id);

	const pluginMatches = (b: PluginBucket) =>
		!q || matches(q, b.name, b.pluginId === UNATTRIBUTED ? undefined : b.pluginId);

	for (const { pluginId, descriptor } of hud.getSettings()) {
		const b = bucketFor(pluginId);
		if (
			pluginMatches(b) ||
			matches(
				q,
				descriptor.label,
				descriptor.id,
				...descriptor.fields.flatMap((f) => [f.name, f.label]),
			)
		) {
			b.settings.push(descriptor);
		}
	}
	for (const { pluginId, action } of actions.getOrdered()) {
		const b = bucketFor(pluginId);
		if (!pluginMatches(b) && !matches(q, action.label, action.group, action.id)) continue;
		const g = action.group ?? "";
		const list = b.actionGroups.get(g) ?? [];
		list.push(action);
		b.actionGroups.set(g, list);
	}
	for (const { pluginId, panel } of hud.getPanels()) {
		const b = bucketFor(pluginId);
		if (pluginMatches(b) || matches(q, panel.title, panel.id)) b.panels.push(panel);
	}

	// Drop empty buckets (plugins with no controls, or none matching the query).
	const result = order.map((k) => byId.get(k) as PluginBucket).filter((b) => bucketSize(b) > 0);
	// Unattributed section sorts last.
	result.sort((a, b) => {
		if (a.pluginId === UNATTRIBUTED) return 1;
		if (b.pluginId === UNATTRIBUTED) return -1;
		return 0;
	});
	return result;
}

/** Split buckets into pinned (in pin order) and the rest (original order). */
export function partitionPinned(
	buckets: readonly PluginBucket[],
	pinned: readonly string[],
): { pinned: PluginBucket[]; rest: PluginBucket[] } {
	const byId = new Map(buckets.map((b) => [b.pluginId, b]));
	const pinnedSet = new Set(pinned);
	return {
		pinned: pinned.flatMap((id) => byId.get(id) ?? []),
		rest: buckets.filter((b) => !pinnedSet.has(b.pluginId)),
	};
}
