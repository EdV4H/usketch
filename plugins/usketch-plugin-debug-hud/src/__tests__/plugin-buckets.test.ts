import type {
	ActionRegistry,
	HudPanel,
	HudRegistry,
	HudSettingsDescriptor,
	PluginAction,
	PluginInfoRegistry,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { bucketSize, buildPluginBuckets, partitionPinned } from "../plugin-buckets.js";

const noop = () => () => {};

function action(id: string, label: string, group?: string): PluginAction {
	return { id, label, group, run: () => {} };
}

function settings(id: string, label: string, fields: string[]): HudSettingsDescriptor {
	return {
		id,
		label,
		fields: fields.map((name) => ({ name, type: "number" as const })),
		get: () => 0,
		set: () => {},
		subscribe: noop,
	};
}

function fixture() {
	const plugins: PluginInfoRegistry = {
		getAll: () => [
			{ id: "snap", name: "Snap" },
			{ id: "map", name: "Map" },
			{ id: "empty", name: "Empty" },
		],
	};
	const actionList = [
		{ id: "snap:toggle", pluginId: "snap", action: action("snap:toggle", "Toggle snap") },
		{ id: "map:paint", pluginId: "map", action: action("map:paint", "Paint cell", "Edit") },
		{ id: "x:raw", pluginId: undefined, action: action("x:raw", "Raw thing") },
	];
	const actions = {
		getAll: () => new Map(actionList.map((a) => [a.id, a.action])),
		getOrdered: () => actionList,
		subscribe: noop,
	} as unknown as ActionRegistry;
	const panel: HudPanel = { id: "map:stats", title: "Terrain stats", render: () => null };
	const hud = {
		getSettings: () => [{ pluginId: "map", descriptor: settings("map:view", "View", ["zoom"]) }],
		getPanels: () => [{ pluginId: "map", panel }],
		subscribe: noop,
	} as unknown as HudRegistry;
	return { actions, hud, plugins };
}

describe("buildPluginBuckets", () => {
	it("groups by plugin, drops empty plugins, puts unattributed last", () => {
		const { actions, hud, plugins } = fixture();
		const buckets = buildPluginBuckets(actions, hud, plugins, "");
		expect(buckets.map((b) => b.name)).toEqual(["Snap", "Map", "Other"]);
		expect(bucketSize(buckets[1])).toBe(3);
	});

	it("a plugin-name match keeps all of the plugin's controls", () => {
		const { actions, hud, plugins } = fixture();
		const [map] = buildPluginBuckets(actions, hud, plugins, "map");
		expect(map.name).toBe("Map");
		expect(bucketSize(map)).toBe(3);
	});

	it("matches settings field names and panel titles", () => {
		const { actions, hud, plugins } = fixture();
		const zoom = buildPluginBuckets(actions, hud, plugins, "zoom");
		expect(zoom.map((b) => [b.name, bucketSize(b)])).toEqual([["Map", 1]]);
		const terrain = buildPluginBuckets(actions, hud, plugins, "terrain");
		expect(terrain[0].panels.map((p) => p.id)).toEqual(["map:stats"]);
	});

	it("returns nothing when no control matches", () => {
		const { actions, hud, plugins } = fixture();
		expect(buildPluginBuckets(actions, hud, plugins, "zzz")).toEqual([]);
	});
});

describe("partitionPinned", () => {
	it("orders pinned by pin order and skips unknown ids", () => {
		const { actions, hud, plugins } = fixture();
		const buckets = buildPluginBuckets(actions, hud, plugins, "");
		const { pinned, rest } = partitionPinned(buckets, ["map", "gone", "snap"]);
		expect(pinned.map((b) => b.pluginId)).toEqual(["map", "snap"]);
		expect(rest.map((b) => b.name)).toEqual(["Other"]);
	});
});
