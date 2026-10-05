// GENERATED from design (RPGマップ素材.dc.html). 36 map icons (landmark/object/marker).
// `nodes` is a parsed SVG element tree (see svg-node.ts) rendered by the consuming
// plugin via React.createElement — no dangerouslySetInnerHTML.
import type { SvgNode } from "./svg-node.js";

export type IconCategory = "landmark" | "object" | "marker";

export interface IconDef {
	key: string;
	en: string;
	ja: string;
	category: IconCategory;
	viewBox: string;
	nodes: SvgNode[];
}

export const ICONS: readonly IconDef[] = [
	{
		key: "town",
		en: "Town",
		ja: "町",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M10 42 V24 L24 14 L38 24 V42 Z", fill: "var(--orange)" } },
					{ t: "path", a: { d: "M6 24 L24 10 L42 24", fill: "none" } },
					{ t: "rect", a: { x: "20", y: "30", width: "8", height: "12", fill: "var(--stroke)" } },
				],
			},
		],
	},
	{
		key: "castle",
		en: "Castle",
		ja: "城",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{
						t: "path",
						a: { d: "M8 42 V18 H14 V24 H20 V18 H28 V24 H34 V18 H40 V42 Z", fill: "var(--purple)" },
					},
					{ t: "path", a: { d: "M20 42 V32 H28 V42", fill: "var(--stroke)" } },
				],
			},
		],
	},
	{
		key: "cave",
		en: "Cave",
		ja: "洞窟",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M6 42 Q11 18 24 18 Q37 18 42 42 Z", fill: "var(--t-mtn)" } },
					{ t: "path", a: { d: "M17 42 Q17 27 24 27 Q31 27 31 42 Z", fill: "var(--stroke)" } },
				],
			},
		],
	},
	{
		key: "tower",
		en: "Tower",
		ja: "塔",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M16 44 V16 H32 V44 Z", fill: "var(--blue)" } },
					{ t: "path", a: { d: "M14 16 L24 6 L34 16", fill: "var(--red)" } },
					{ t: "path", a: { d: "M34 8 L42 6 L40 12 L34 12", fill: "var(--yellow)" } },
					{ t: "path", a: { d: "M34 6 V16", fill: "none" } },
					{ t: "rect", a: { x: "21", y: "34", width: "6", height: "10", fill: "var(--stroke)" } },
				],
			},
		],
	},
	{
		key: "shrine",
		en: "Shrine",
		ja: "神社",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M8 18 Q24 10 40 18", fill: "none" } },
					{ t: "path", a: { d: "M5 24 H43", fill: "none", "stroke-width": "3.4" } },
					{ t: "path", a: { d: "M13 24 V44 M35 24 V44", fill: "var(--red)" } },
				],
			},
		],
	},
	{
		key: "temple",
		en: "Temple",
		ja: "寺院",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M6 40 Q6 22 16 22 H32 Q42 22 42 40 Z", fill: "var(--teal)" } },
					{ t: "path", a: { d: "M14 22 V12 H34 V22", fill: "var(--teal)" } },
					{ t: "path", a: { d: "M20 40 V30 H28 V40", fill: "var(--stroke)" } },
					{ t: "path", a: { d: "M12 8 H36 L34 12 H14 Z", fill: "var(--red)" } },
				],
			},
		],
	},
	{
		key: "lighthouse",
		en: "Lighthouse",
		ja: "灯台",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M16 44 V14 H32 V44 Z", fill: "var(--card)" } },
					{ t: "path", a: { d: "M16 24 H32 M16 34 H32", fill: "none" } },
					{ t: "path", a: { d: "M17 14 L24 5 L31 14", fill: "var(--red)" } },
					{ t: "circle", a: { cx: "24", cy: "19", r: "3.4", fill: "var(--yellow)" } },
				],
			},
		],
	},
	{
		key: "windmill",
		en: "Windmill",
		ja: "風車",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M13 44 L19 18 H29 L35 44 Z", fill: "var(--card)" } },
					{ t: "path", a: { d: "M17 36 H31", fill: "none" } },
					{ t: "path", a: { d: "M21 44 V38 H27 V44", fill: "var(--stroke)" } },
					{
						t: "path",
						a: { d: "M24 16 L24 2 L34 8 Z", fill: "var(--teal)", "stroke-width": "2.4" },
					},
					{
						t: "path",
						a: { d: "M24 16 L38 16 L32 26 Z", fill: "var(--teal)", "stroke-width": "2.4" },
					},
					{
						t: "path",
						a: { d: "M24 16 L24 30 L14 24 Z", fill: "var(--teal)", "stroke-width": "2.4" },
					},
					{
						t: "path",
						a: { d: "M24 16 L10 16 L16 6 Z", fill: "var(--teal)", "stroke-width": "2.4" },
					},
				],
			},
		],
	},
	{
		key: "port",
		en: "Port",
		ja: "港",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M4 30 H20 V42 H4 Z", fill: "var(--brown)" } },
					{ t: "path", a: { d: "M12 30 V42", fill: "none" } },
					{ t: "path", a: { d: "M28 6 V32", fill: "none" } },
					{ t: "path", a: { d: "M28 8 L42 15 L28 22 Z", fill: "var(--red)" } },
					{ t: "path", a: { d: "M20 32 H44 L38 42 H26 Z", fill: "var(--blue)" } },
				],
			},
		],
	},
	{
		key: "ruins",
		en: "Ruins",
		ja: "遺跡",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M6 42 H42", fill: "none", "stroke-width": "3.4" } },
					{ t: "path", a: { d: "M10 42 V18 L14 14 V42 Z", fill: "var(--t-stone)" } },
					{ t: "path", a: { d: "M22 42 V24 L26 20 V42 Z", fill: "var(--t-stone)" } },
					{ t: "path", a: { d: "M34 42 V12 L38 8 V42 Z", fill: "var(--t-stone)" } },
					{ t: "path", a: { d: "M14 20 H22 M26 26 H34", fill: "none" } },
				],
			},
		],
	},
	{
		key: "mine",
		en: "Mine",
		ja: "鉱山",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M4 42 Q8 22 24 22 Q40 22 44 42 Z", fill: "var(--t-mtn)" } },
					{
						t: "path",
						a: { d: "M16 42 V32 Q16 26 24 26 Q32 26 32 32 V42 Z", fill: "var(--stroke)" },
					},
					{
						t: "path",
						a: {
							d: "M13 42 V30 M35 42 V30",
							fill: "none",
							stroke: "var(--brown)",
							"stroke-width": "3.4",
						},
					},
					{
						t: "path",
						a: { d: "M10 30 H38", fill: "none", stroke: "var(--brown)", "stroke-width": "3.4" },
					},
				],
			},
		],
	},
	{
		key: "graveyard",
		en: "Graveyard",
		ja: "墓地",
		category: "landmark",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M4 42 H44", fill: "none", "stroke-width": "3.4" } },
					{
						t: "path",
						a: { d: "M10 42 V20 Q10 12 18 12 Q26 12 26 20 V42 Z", fill: "var(--muted)" },
					},
					{ t: "path", a: { d: "M18 18 V32 M12 24 H24", fill: "none" } },
					{
						t: "path",
						a: { d: "M32 42 V26 Q32 20 37 20 Q42 20 42 26 V42 Z", fill: "var(--muted)" },
					},
				],
			},
		],
	},
	{
		key: "chest",
		en: "Chest",
		ja: "宝箱",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M8 20 Q8 12 24 12 Q40 12 40 20 V40 H8 Z", fill: "var(--yellow)" } },
					{ t: "path", a: { d: "M8 22 H40", fill: "none" } },
					{ t: "rect", a: { x: "20", y: "20", width: "8", height: "9", fill: "var(--stroke)" } },
				],
			},
		],
	},
	{
		key: "signpost",
		en: "Signpost",
		ja: "看板",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M24 12 V44", fill: "none" } },
					{ t: "path", a: { d: "M6 8 H26 L32 14 L26 20 H6 Z", fill: "var(--brown)" } },
					{ t: "path", a: { d: "M24 22 H42 L38 27 L42 32 H24", fill: "var(--brown)" } },
				],
			},
		],
	},
	{
		key: "campfire",
		en: "Campfire",
		ja: "たき火",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M24 12 Q30 22 24 30 Q18 22 24 12 Z", fill: "var(--red)" } },
					{ t: "path", a: { d: "M24 22 Q27 27 24 30 Q21 27 24 22 Z", fill: "var(--yellow)" } },
					{
						t: "path",
						a: {
							d: "M10 42 L38 34 M38 42 L10 34",
							fill: "none",
							stroke: "var(--brown)",
							"stroke-width": "3.4",
						},
					},
				],
			},
		],
	},
	{
		key: "bridge",
		en: "Bridge",
		ja: "橋",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M4 20 Q24 6 44 20", fill: "none" } },
					{ t: "path", a: { d: "M6 22 H42", fill: "none" } },
					{ t: "path", a: { d: "M11 22 V40 M37 22 V40", fill: "none" } },
					{ t: "path", a: { d: "M6 30 H42 M18 22 V30 M30 22 V30", fill: "var(--orange)" } },
				],
			},
		],
	},
	{
		key: "boat",
		en: "Boat",
		ja: "船",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M24 8 V30", fill: "none" } },
					{ t: "path", a: { d: "M24 10 L38 16 L24 22 Z", fill: "var(--red)" } },
					{ t: "path", a: { d: "M8 34 H40 L34 44 H14 Z", fill: "var(--brown)" } },
				],
			},
		],
	},
	{
		key: "well",
		en: "Well",
		ja: "井戸",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M10 8 L24 4 L38 8 L34 14 H14 Z", fill: "var(--red)" } },
					{ t: "path", a: { d: "M12 14 V44 M36 14 V44", fill: "none" } },
					{ t: "path", a: { d: "M12 26 H36", fill: "none" } },
					{ t: "ellipse", a: { cx: "24", cy: "26", rx: "9", ry: "6", fill: "var(--t-water)" } },
				],
			},
		],
	},
	{
		key: "tree",
		en: "Tree",
		ja: "木",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M24 44 V26", fill: "none" } },
					{ t: "path", a: { d: "M24 28 Q8 26 10 12 Q24 12 24 28 Z", fill: "var(--green)" } },
					{ t: "path", a: { d: "M24 28 Q40 26 38 12 Q24 12 24 28 Z", fill: "var(--t-forest)" } },
				],
			},
		],
	},
	{
		key: "rock",
		en: "Rock",
		ja: "岩",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{
						t: "path",
						a: {
							d: "M6 38 Q4 22 16 20 Q22 8 32 16 Q44 18 42 32 Q40 40 30 38 Z",
							fill: "var(--t-mtn)",
						},
					},
					{ t: "path", a: { d: "M16 30 L22 24 L28 30", fill: "none" } },
				],
			},
		],
	},
	{
		key: "mushroom",
		en: "Mushroom",
		ja: "キノコ",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M24 44 V26", fill: "none" } },
					{
						t: "path",
						a: { d: "M8 24 Q8 8 24 8 Q40 8 40 24 Q32 28 24 24 Q16 28 8 24 Z", fill: "var(--red)" },
					},
					{ t: "circle", a: { cx: "18", cy: "16", r: "2.6", fill: "var(--card)" } },
					{ t: "circle", a: { cx: "29", cy: "19", r: "2", fill: "var(--card)" } },
				],
			},
		],
	},
	{
		key: "tent",
		en: "Tent",
		ja: "テント",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M6 40 L24 10 L42 40 Z", fill: "var(--teal)" } },
					{ t: "path", a: { d: "M24 10 V40", fill: "none" } },
					{ t: "path", a: { d: "M16 40 L24 22 L32 40 Z", fill: "var(--stroke)" } },
				],
			},
		],
	},
	{
		key: "barrel",
		en: "Barrel",
		ja: "樽",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M14 8 Q6 24 14 40 H34 Q42 24 34 8 Z", fill: "var(--brown)" } },
					{ t: "path", a: { d: "M9 16 H39 M9 32 H39", fill: "none" } },
				],
			},
		],
	},
	{
		key: "gate",
		en: "Gate",
		ja: "門",
		category: "object",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M10 42 V14 Q10 6 24 6 Q38 6 38 14 V42", fill: "var(--purple)" } },
					{ t: "path", a: { d: "M10 20 H38", fill: "none" } },
					{
						t: "path",
						a: { d: "M18 42 V26 Q18 20 24 20 Q30 20 30 26 V42", fill: "var(--stroke)" },
					},
				],
			},
		],
	},
	{
		key: "player-pin",
		en: "Player Pin",
		ja: "現在地",
		category: "marker",
		viewBox: "0 0 40 52",
		nodes: [
			{
				t: "path",
				a: {
					d: "M20 50 C6 32 4 24 4 18 A16 16 0 0 1 36 18 C36 24 34 32 20 50 Z",
					fill: "var(--red)",
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
				},
			},
			{
				t: "circle",
				a: {
					cx: "20",
					cy: "18",
					r: "7",
					fill: "#fff",
					stroke: "var(--stroke)",
					"stroke-width": "3",
				},
			},
		],
	},
	{
		key: "quest",
		en: "Quest",
		ja: "クエスト",
		category: "marker",
		viewBox: "0 0 40 44",
		nodes: [
			{
				t: "circle",
				a: {
					cx: "20",
					cy: "18",
					r: "15",
					fill: "var(--yellow)",
					stroke: "var(--stroke)",
					"stroke-width": "3",
				},
			},
			{
				t: "path",
				a: {
					d: "M20 9 V21 M20 26 V27.6",
					fill: "none",
					stroke: "var(--stroke)",
					"stroke-width": "3.6",
					"stroke-linecap": "round",
				},
			},
		],
	},
	{
		key: "flag",
		en: "Flag",
		ja: "拠点旗",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M14 44 V6", fill: "none" } },
					{ t: "path", a: { d: "M14 8 H38 L32 15 L38 22 H14 Z", fill: "var(--green)" } },
				],
			},
		],
	},
	{
		key: "monster",
		en: "Monster",
		ja: "敵",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{
						t: "path",
						a: {
							d: "M8 42 Q6 20 24 20 Q42 20 40 42 Q34 37 30 42 Q26 37 24 42 Q22 37 18 42 Q14 37 8 42 Z",
							fill: "var(--green)",
						},
					},
					{ t: "circle", a: { cx: "18", cy: "29", r: "3", fill: "#fff" } },
					{ t: "circle", a: { cx: "30", cy: "29", r: "3", fill: "#fff" } },
					{ t: "circle", a: { cx: "18", cy: "29", r: "1.2", fill: "var(--stroke)" } },
					{ t: "circle", a: { cx: "30", cy: "29", r: "1.2", fill: "var(--stroke)" } },
				],
			},
		],
	},
	{
		key: "objective",
		en: "Objective",
		ja: "目標",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "path",
				a: {
					d: "M24 6 L30 18 L44 20 L34 30 L36 44 L24 37 L12 44 L14 30 L4 20 L18 18 Z",
					fill: "var(--yellow)",
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
				},
			},
		],
	},
	{
		key: "compass",
		en: "Compass",
		ja: "方位",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "circle", a: { cx: "24", cy: "24", r: "18", fill: "var(--card)" } },
					{ t: "path", a: { d: "M24 8 V13 M24 35 V40 M8 24 H13 M35 24 H40", fill: "none" } },
					{ t: "path", a: { d: "M24 24 L33 15 L27 27 Z", fill: "var(--red)" } },
				],
			},
		],
	},
	{
		key: "danger",
		en: "Danger",
		ja: "危険地帯",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M24 6 L44 40 H4 Z", fill: "var(--orange)" } },
					{ t: "path", a: { d: "M24 18 V28 M24 33 V34.4", fill: "none", "stroke-width": "3.6" } },
				],
			},
		],
	},
	{
		key: "shop",
		en: "Shop",
		ja: "店",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "path", a: { d: "M10 18 H38 L35 42 H13 Z", fill: "var(--teal)" } },
					{ t: "path", a: { d: "M18 22 V14 Q18 7 24 7 Q30 7 30 14 V22", fill: "none" } },
				],
			},
		],
	},
	{
		key: "warp",
		en: "Warp",
		ja: "ワープ",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{
						t: "ellipse",
						a: { cx: "24", cy: "24", rx: "19", ry: "10", fill: "none", stroke: "var(--purple)" },
					},
					{
						t: "ellipse",
						a: { cx: "24", cy: "24", rx: "10", ry: "19", fill: "none", stroke: "var(--purple)" },
					},
					{ t: "circle", a: { cx: "24", cy: "24", r: "6", fill: "var(--purple)" } },
				],
			},
		],
	},
	{
		key: "heal",
		en: "Heal",
		ja: "回復",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{
						t: "path",
						a: {
							d: "M24 42 C10 30 5 24 5 17 A11 11 0 0 1 24 11 A11 11 0 0 1 43 17 C43 24 38 30 24 42 Z",
							fill: "var(--pink)",
						},
					},
					{
						t: "path",
						a: {
							d: "M24 18 V30 M18 24 H30",
							fill: "none",
							stroke: "var(--card)",
							"stroke-width": "3.4",
						},
					},
				],
			},
		],
	},
	{
		key: "key",
		en: "Key",
		ja: "鍵",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{ t: "circle", a: { cx: "16", cy: "16", r: "9", fill: "var(--yellow)" } },
					{ t: "circle", a: { cx: "16", cy: "16", r: "3", fill: "var(--card)" } },
					{ t: "path", a: { d: "M22 22 L40 40 M34 34 L30 38 M38 38 L34 42", fill: "none" } },
				],
			},
		],
	},
	{
		key: "save",
		en: "Save",
		ja: "セーブ",
		category: "marker",
		viewBox: "0 0 48 48",
		nodes: [
			{
				t: "g",
				a: {
					stroke: "var(--stroke)",
					"stroke-width": "3",
					"stroke-linejoin": "round",
					"stroke-linecap": "round",
				},
				c: [
					{
						t: "rect",
						a: { x: "7", y: "7", width: "34", height: "34", rx: "6", fill: "var(--blue)" },
					},
					{
						t: "path",
						a: {
							d: "M16 20 L22 27 L33 15",
							fill: "none",
							stroke: "var(--card)",
							"stroke-width": "4",
						},
					},
				],
			},
		],
	},
];

export const ICONS_BY_KEY: ReadonlyMap<string, IconDef> = new Map(ICONS.map((i) => [i.key, i]));

export const ICON_CATEGORIES: readonly { id: IconCategory; label: string }[] = [
	{ id: "landmark", label: "ランドマーク" },
	{ id: "object", label: "オブジェクト" },
	{ id: "marker", label: "マーカー" },
];
