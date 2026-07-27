// GENERATED from design (RPGマップ素材.dc.html). 12 terrain tile definitions.
// `nodes` is a parsed SVG element tree (see svg-nodes.tsx) rendered via
// React.createElement — no dangerouslySetInnerHTML. Fills reference design CSS
// vars (var(--t-*)) provided by terrainCssVars().
import type { SvgNode } from "./svg-nodes.js";

export type TerrainKey =
	| "grass"
	| "forest"
	| "water"
	| "sand"
	| "mtn"
	| "path"
	| "snow"
	| "swamp"
	| "lava"
	| "stone"
	| "farm"
	| "flower";

export interface TerrainDef {
	key: TerrainKey;
	name: string;
	en: string;
	patternWidth: number;
	patternHeight: number;
	nodes: SvgNode[];
}

export const TERRAINS: readonly TerrainDef[] = [
	{
		key: "grass",
		name: "草原",
		en: "Grass",
		patternWidth: 24,
		patternHeight: 24,
		nodes: [
			{ t: "rect", a: { width: "24", height: "24", fill: "var(--t-grass)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-grass-d)",
					"stroke-width": "1.6",
					"stroke-linecap": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M5 18 V13 M3 16 L5 13 L7 16" } },
					{ t: "path", a: { d: "M16 22 V17 M14 20 L16 17 L18 20" } },
					{ t: "path", a: { d: "M13 9 V5 M11 7 L13 5 L15 7" } },
				],
			},
		],
	},
	{
		key: "forest",
		name: "森",
		en: "Forest",
		patternWidth: 26,
		patternHeight: 26,
		nodes: [
			{ t: "rect", a: { width: "26", height: "26", fill: "var(--t-forest)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-forest-d)",
					"stroke-width": "1.6",
					"stroke-linecap": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M4 15 a4 4 0 1 1 8 0" } },
					{ t: "path", a: { d: "M8 15 V19" } },
					{ t: "path", a: { d: "M17 25 a4 4 0 1 1 8 0" } },
					{ t: "path", a: { d: "M17 6 a3.4 3.4 0 1 1 6.8 0" } },
				],
			},
		],
	},
	{
		key: "water",
		name: "水辺",
		en: "Water",
		patternWidth: 24,
		patternHeight: 24,
		nodes: [
			{ t: "rect", a: { width: "24", height: "24", fill: "var(--t-water)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-water-d)",
					"stroke-width": "1.6",
					"stroke-linecap": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M0 6 Q6 2 12 6 T24 6" } },
					{ t: "path", a: { d: "M0 14 Q6 10 12 14 T24 14" } },
					{ t: "path", a: { d: "M0 22 Q6 18 12 22 T24 22" } },
				],
			},
		],
	},
	{
		key: "sand",
		name: "砂漠",
		en: "Sand",
		patternWidth: 22,
		patternHeight: 22,
		nodes: [
			{ t: "rect", a: { width: "22", height: "22", fill: "var(--t-sand)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-sand-d)",
					"stroke-width": "1.5",
					"stroke-linecap": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M2 8 Q8 4 14 8" } },
					{ t: "path", a: { d: "M9 16 Q15 12 21 16" } },
				],
			},
			{
				t: "g",
				a: { fill: "var(--t-sand-d)" },
				c: [
					{ t: "circle", a: { cx: "6", cy: "17", r: "1" } },
					{ t: "circle", a: { cx: "18", cy: "5", r: "1" } },
				],
			},
		],
	},
	{
		key: "mtn",
		name: "山",
		en: "Mountain",
		patternWidth: 24,
		patternHeight: 24,
		nodes: [
			{ t: "rect", a: { width: "24", height: "24", fill: "var(--t-mtn)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-mtn-d)",
					"stroke-width": "1.6",
					"stroke-linecap": "round",
					"stroke-linejoin": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M3 15 l4 -5 l4 5" } },
					{ t: "path", a: { d: "M14 22 l4 -5 l4 5" } },
					{ t: "path", a: { d: "M13 8 l3 -4 l3 4" } },
				],
			},
		],
	},
	{
		key: "path",
		name: "道",
		en: "Road",
		patternWidth: 20,
		patternHeight: 20,
		nodes: [
			{ t: "rect", a: { width: "20", height: "20", fill: "var(--t-path)" } },
			{
				t: "g",
				a: { fill: "var(--t-path-d)" },
				c: [
					{ t: "circle", a: { cx: "5", cy: "6", r: "2" } },
					{ t: "circle", a: { cx: "14", cy: "12", r: "2.2" } },
					{ t: "circle", a: { cx: "9", cy: "16", r: "1.6" } },
				],
			},
		],
	},
	{
		key: "snow",
		name: "雪原",
		en: "Snow",
		patternWidth: 24,
		patternHeight: 24,
		nodes: [
			{ t: "rect", a: { width: "24", height: "24", fill: "var(--t-snow)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-snow-d)",
					"stroke-width": "1.5",
					"stroke-linecap": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M6 4 V10 M3.4 5.6 L8.6 8.6 M8.6 5.6 L3.4 8.6" } },
					{ t: "path", a: { d: "M17 15 V20 M14.8 16.2 L19.2 18.8 M19.2 16.2 L14.8 18.8" } },
					{ t: "path", a: { d: "M0 13 Q5 11 10 13" } },
				],
			},
		],
	},
	{
		key: "swamp",
		name: "沼地",
		en: "Swamp",
		patternWidth: 26,
		patternHeight: 26,
		nodes: [
			{ t: "rect", a: { width: "26", height: "26", fill: "var(--t-swamp)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-swamp-d)",
					"stroke-width": "1.6",
					"stroke-linecap": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M5 22 V14 M8 22 V16 M2 22 V17" } },
					{ t: "path", a: { d: "M17 10 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0" } },
					{ t: "path", a: { d: "M13 24 Q17 21 21 24" } },
				],
			},
		],
	},
	{
		key: "lava",
		name: "溶岩",
		en: "Lava",
		patternWidth: 24,
		patternHeight: 24,
		nodes: [
			{ t: "rect", a: { width: "24", height: "24", fill: "var(--t-lava)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-lava-d)",
					"stroke-width": "1.7",
					"stroke-linecap": "round",
					"stroke-linejoin": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M1 5 L7 9 L4 15 L9 20" } },
					{ t: "path", a: { d: "M14 2 L17 8 L23 10" } },
					{ t: "path", a: { d: "M13 22 L18 17 L24 19" } },
				],
			},
		],
	},
	{
		key: "stone",
		name: "石床",
		en: "Stone Floor",
		patternWidth: 26,
		patternHeight: 20,
		nodes: [
			{ t: "rect", a: { width: "26", height: "20", fill: "var(--t-stone)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-stone-d)",
					"stroke-width": "1.6",
					"stroke-linecap": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M0 10 H26 M0 20 H26" } },
					{ t: "path", a: { d: "M8 0 V10 M20 10 V20" } },
				],
			},
		],
	},
	{
		key: "farm",
		name: "畑",
		en: "Farmland",
		patternWidth: 22,
		patternHeight: 22,
		nodes: [
			{ t: "rect", a: { width: "22", height: "22", fill: "var(--t-farm)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-farm-d)",
					"stroke-width": "1.7",
					"stroke-linecap": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M0 5 Q11 2.5 22 5" } },
					{ t: "path", a: { d: "M0 12 Q11 9.5 22 12" } },
					{ t: "path", a: { d: "M0 19 Q11 16.5 22 19" } },
				],
			},
		],
	},
	{
		key: "flower",
		name: "花畑",
		en: "Flower Field",
		patternWidth: 24,
		patternHeight: 24,
		nodes: [
			{ t: "rect", a: { width: "24", height: "24", fill: "var(--t-flower)" } },
			{
				t: "g",
				a: {
					stroke: "var(--t-flower-d)",
					"stroke-width": "1.5",
					"stroke-linecap": "round",
					fill: "none",
				},
				c: [
					{ t: "path", a: { d: "M4 20 V15 M15 11 V6" } },
					{
						t: "path",
						a: {
							d: "M4 12 a2.4 2.4 0 1 0 4.8 0 a2.4 2.4 0 1 0 -4.8 0",
							transform: "translate(-2 1)",
						},
					},
					{ t: "path", a: { d: "M13 3 a2.4 2.4 0 1 0 4.8 0 a2.4 2.4 0 1 0 -4.8 0" } },
					{ t: "path", a: { d: "M17 20 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0" } },
				],
			},
		],
	},
];

export const TERRAIN_KEYS: readonly TerrainKey[] = TERRAINS.map((t) => t.key);

export function terrainPatternId(key: TerrainKey): string {
	return `uskmap-pat-${key}`;
}

export function terrainDarkVar(key: TerrainKey): string {
	return `var(--t-${key}-d)`;
}
