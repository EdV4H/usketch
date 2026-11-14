// 3D レンダラーの比較用の場面（#1304 P6c）。`?scene3d=hills|many|drive` で開くと、空の
// ボードに決まった場面を置き、3D 表示（Mode 7）を決まったカメラで始める。HUD の「3D 比較」
// から、同じ場面をもう一方のレンダラーで開き直したり、フレーム時間を測ったりできる。
//
// 場面とフレーム時間の集計は純関数（`compare3dShapes` / `frameStats`）。測るのは
// `measure3d`（requestAnimationFrame の間隔を記録する）。CSS 3D と GPU のどちらでも同じ
// 場面・同じ動きで測れるように、場面はシード固定で作る。

import { characterService } from "@edv4h/usketch-plugin-character";
import { elevationService } from "@edv4h/usketch-plugin-elevation";
import { mode7Service } from "@edv4h/usketch-plugin-mode7";
import type {
	PluginContext,
	ShapeData,
	ShapeRegistry,
	ShapeView3dInput,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";

/** 比べる場面。 */
export type Compare3dScene = "hills" | "many" | "drive";

export const COMPARE3D_SCENES: readonly Compare3dScene[] = ["hills", "many", "drive"];

const SCENE_LABELS: Record<Compare3dScene, string> = {
	hills: "標高の山・谷 ＋ 3D の Shape 30 個",
	many: "平らな Shape 300 個 ＋ 3D の Shape 50 個",
	drive: "車で坂を走る（追従カメラ）",
};

/** 場面の Shape の id の頭。 */
export const COMPARE3D_ID_PREFIX = "cmp3d-";
/** 場面の標高のシード（どちらのレンダラーでも同じ地形にする）。 */
export const COMPARE3D_ELEVATION_SEED = 1304;

/** URL の `?scene3d=` を読む。比較の場面でなければ `null`。 */
export function readCompare3dScene(search: string): Compare3dScene | null {
	const v = new URLSearchParams(search).get("scene3d");
	return COMPARE3D_SCENES.includes(v as Compare3dScene) ? (v as Compare3dScene) : null;
}

/** 決まった列の乱数（mulberry32）。 */
function random(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const STICKY_FILLS = ["#fff59d", "#ffccbc", "#c8e6c9", "#bbdefb", "#e1bee7"];
const WORDS = [
	"地図",
	"計画",
	"メモ",
	"アイデア",
	"Todo",
	"Done",
	"質問",
	"決定",
	"課題",
	"Mode 7",
];

/** 画像の Shape に使う絵（外部 URL を使わない data URL の SVG）。 */
function imageSrc(hue: number): string {
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150">` +
		`<defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,60%)"/>` +
		`<stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,40%)"/></linearGradient></defs>` +
		`<rect width="200" height="150" fill="url(#g)"/><circle cx="150" cy="40" r="22" fill="#fff8"/></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 場面の Shape（id は {@link COMPARE3D_ID_PREFIX} から始まる）。種別が登録されていない
 * ものは入れない。同じ場面なら毎回同じものを返す。Pure.
 */
export function compare3dShapes(scene: Compare3dScene, registry: ShapeRegistry): ShapeData[] {
	const rand = random(scene === "hills" ? 1 : scene === "many" ? 2 : 3);
	const out: ShapeData[] = [];
	const add = (
		type: string,
		x: number,
		y: number,
		extra: Record<string, unknown> = {},
		view3d?: ShapeView3dInput,
	): void => {
		const def = registry.get(type);
		if (!def) return;
		const id = `${COMPARE3D_ID_PREFIX}${scene}-${out.length}`;
		const base = def.createDefault({ id, x: Math.round(x), y: Math.round(y) });
		out.push({ ...base, ...extra, ...(view3d ? { view3d } : {}) } as ShapeData);
	};
	const word = () => WORDS[Math.floor(rand() * WORDS.length)];
	const fill = () => STICKY_FILLS[Math.floor(rand() * STICKY_FILLS.length)];
	const solid = (i: number, x: number, y: number): void => {
		const kind = i % 3;
		if (kind === 0) {
			add(
				"sticky",
				x,
				y,
				{ text: `看板 ${i}`, style: { fill: fill(), stroke: "none", strokeWidth: 0, opacity: 1 } },
				{
					mode: "stand",
					facing: i % 2 ? "camera" : "fixed",
				},
			);
		} else if (kind === 1) {
			add(
				"rectangle",
				x,
				y,
				{ width: 120, height: 120 },
				{ mode: "box", height: 40 + Math.round(rand() * 80) },
			);
		} else {
			add(
				"ellipse",
				x,
				y,
				{ width: 110, height: 110 },
				{ mode: "float", height: 40 + Math.round(rand() * 60) },
			);
		}
	};

	if (scene === "hills" || scene === "drive") {
		// 3D の Shape 30 個を 6 × 5 に（丘の向こうに隠れるものも出るよう、広く散らす）。
		for (let i = 0; i < 30; i++) {
			const col = i % 6;
			const row = Math.floor(i / 6);
			solid(i, col * 420 - 1000 + rand() * 120, row * -480 + 200 + rand() * 120);
		}
		// 平らな Shape 20 個。
		for (let i = 0; i < 20; i++) {
			const x = (i % 5) * 380 - 900 + rand() * 80;
			const y = Math.floor(i / 5) * -520 + 420 + rand() * 80;
			if (i % 2)
				add("sticky", x, y, {
					text: word(),
					style: { fill: fill(), stroke: "none", strokeWidth: 0, opacity: 1 },
				});
			else add("text", x, y, { text: `${word()} ${i}`, fontSize: 24 });
		}
		return out;
	}

	// many: 平らな Shape 300 個（付箋・文字・画像・図形）＋ 3D の Shape 50 個。
	for (let i = 0; i < 300; i++) {
		const x = (i % 20) * 230 - 2300 + rand() * 30;
		const y = Math.floor(i / 20) * -210 + 600 + rand() * 30;
		switch (i % 5) {
			case 0:
				add("sticky", x, y, {
					text: `${word()}\n${i}`,
					style: { fill: fill(), stroke: "none", strokeWidth: 0, opacity: 1 },
				});
				break;
			case 1:
				add("text", x, y, { text: `${word()} ${i}`, fontSize: 20 });
				break;
			case 2:
				add("image", x, y, { width: 180, height: 135, src: imageSrc(Math.floor(rand() * 360)) });
				break;
			case 3:
				add("rectangle", x, y, { width: 160, height: 110 });
				break;
			default:
				add("ellipse", x, y, { width: 150, height: 110 });
		}
	}
	for (let i = 0; i < 50; i++) {
		solid(i, (i % 10) * 460 - 2300 + rand() * 60, Math.floor(i / 10) * -640 + 400 + rand() * 60);
	}
	return out;
}

/** フレーム時間の集計（ms）。 */
export interface FrameStats {
	frames: number;
	p50: number;
	p95: number;
	max: number;
	/** 平均のフレーム数 / 秒。 */
	fps: number;
}

/** フレーム間隔（ms）の列を集計する。Pure. */
export function frameStats(deltas: readonly number[]): FrameStats {
	const d = deltas.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
	if (d.length === 0) return { frames: 0, p50: 0, p95: 0, max: 0, fps: 0 };
	const at = (q: number) => d[Math.min(d.length - 1, Math.floor(q * d.length))];
	const sum = d.reduce((a, b) => a + b, 0);
	const r = (v: number) => Math.round(v * 10) / 10;
	return {
		frames: d.length,
		p50: r(at(0.5)),
		p95: r(at(0.95)),
		max: r(d[d.length - 1]),
		fps: r((1000 * d.length) / sum),
	};
}

/** 測った結果（ひとつの場面・ひとつのレンダラー）。 */
export interface Compare3dResult {
	scene: Compare3dScene;
	renderer: "css" | "gpu";
	userAgent: string;
	/** 3D 表示のまま動かしたとき。 */
	move: FrameStats;
	/** 平面 → 3D の遷移 1 回。 */
	transition: FrameStats & { ms: number };
	/** 3D 表示で Shape を 1 つ動かし続けたとき。 */
	drag: FrameStats;
}

const WARMUP_FRAMES = 10;

/** `durationMs` の間、毎フレーム `step(t)` を呼んでフレーム間隔を集める。 */
function recordFrames(
	durationMs: number,
	step: (t: number) => void,
	until?: () => boolean,
	warmup = WARMUP_FRAMES,
): Promise<number[]> {
	return new Promise((resolve) => {
		const deltas: number[] = [];
		const start = performance.now();
		let last = start;
		let n = 0;
		const frame = (now: number) => {
			const t = now - start;
			if (n++ >= warmup) deltas.push(now - last);
			last = now;
			if (t >= durationMs || until?.()) {
				resolve(deltas);
				return;
			}
			step(t);
			requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
	});
}

/** 場面のカメラ（3D 表示を始める前に置く）。 */
function placeCamera(ctx: PluginContext, scene: Compare3dScene): void {
	ctx.store.setViewport({ x: 640, y: 560, zoom: scene === "many" ? 0.7 : 0.8, rotation: 0 });
	const m7 = mode7Service.get(ctx.services);
	m7?.setPitch(62);
	m7?.setHeight(scene === "drive" ? 40 : 60);
	m7?.setDrawDistance(3000);
}

/** 場面を置き直す（場面の Shape を消してから置く）。標高・キャラ・カメラも整える。 */
export function placeCompare3dScene(ctx: PluginContext, scene: Compare3dScene): void {
	for (const id of [...ctx.store.getShapes().keys()]) {
		if (id.startsWith(COMPARE3D_ID_PREFIX)) ctx.store.deleteShape(id);
	}
	for (const s of compare3dShapes(scene, ctx.shapes)) ctx.store.addShape(s);
	const elevation = elevationService.get(ctx.services);
	if (scene === "many") elevation?.disableInfinite();
	else elevation?.enableInfinite({ seed: COMPARE3D_ELEVATION_SEED });
	const character = characterService.get(ctx.services);
	if (character) {
		character.enable();
		character.setControlScheme(scene === "drive" ? "vehicle" : "directional");
		character.setPosition({ x: 0, y: 0 });
		character.setHeading(0);
		character.setCameraMode(scene === "drive" ? "rotate" : "free");
	}
	placeCamera(ctx, scene);
	mode7Service.get(ctx.services)?.enable({ animate: false });
}

/** 3 つの測り方を順に走らせる（合わせて 15 秒ほど）。 */
export async function measure3d(
	ctx: PluginContext,
	scene: Compare3dScene,
	renderer: "css" | "gpu",
): Promise<Compare3dResult> {
	const m7 = mode7Service.get(ctx.services);
	const character = characterService.get(ctx.services);
	placeCamera(ctx, scene);
	m7?.enable({ animate: false });
	await recordFrames(500, () => {});

	// 1. 3D 表示のまま動かす（drive は車が自分で走る。ほかは横へ流す）。
	const start = ctx.store.getViewport();
	if (scene === "drive") character?.setVirtualInput({ throttle: 1, steer: 0.35, drift: false });
	const move = await recordFrames(6000, (t) => {
		if (scene !== "drive") ctx.store.setViewport({ ...start, x: start.x - t * 0.25 });
	});
	if (scene === "drive") character?.setVirtualInput(null);

	// 2. 平面 → 3D の遷移 1 回。
	placeCamera(ctx, scene);
	m7?.disable({ animate: false });
	await recordFrames(300, () => {});
	const t0 = performance.now();
	m7?.enable({ animate: true });
	const transition = await recordFrames(
		5000,
		() => {},
		() => !(m7?.isTransitioning() ?? false),
		// Every frame of the transition counts.
		0,
	);
	const transitionMs = Math.round(performance.now() - t0);

	// 3. Shape を 1 つ動かし続ける（GPU は Shape の絵を作り直す）。
	const target = [...ctx.store.getShapes().values()].find(
		(s) => s.id.startsWith(COMPARE3D_ID_PREFIX) && !(s as { view3d?: unknown }).view3d,
	);
	const origin = target ? { x: target.x, y: target.y } : null;
	const drag = await recordFrames(3000, (t) => {
		if (target && origin)
			ctx.store.updateShape(target.id, { x: origin.x + Math.sin(t / 300) * 120 });
	});
	if (target && origin) ctx.store.updateShape(target.id, origin);

	return {
		scene,
		renderer,
		userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
		move: frameStats(move),
		transition: { ...frameStats(transition), ms: transitionMs },
		drag: frameStats(drag),
	};
}

/** 結果を 1 行の文字にする（HUD に出して、そのまま貼れるように）。Pure. */
export function formatCompare3dResult(r: Compare3dResult): string {
	const f = (s: FrameStats) => `p50 ${s.p50} / p95 ${s.p95} / max ${s.max} ms (${s.fps} fps)`;
	return [
		`[${r.renderer}] ${r.scene}`,
		`移動: ${f(r.move)}`,
		`遷移: ${r.transition.ms} ms, ${f(r.transition)}`,
		`Shape を動かす: ${f(r.drag)}`,
		r.userAgent,
	].join("\n");
}

/** 同じ場面をもう一方のレンダラーで開く URL の検索部分。Pure. */
export function otherRendererSearch(search: string, renderer: "css" | "gpu"): string {
	const params = new URLSearchParams(search);
	if (renderer === "gpu") params.delete("renderer3d");
	else params.set("renderer3d", "gpu");
	const s = params.toString();
	return s ? `?${s}` : "";
}

/**
 * 比較の場面のプラグイン。図形・標高・キャラ・Mode 7 の後に置く。ボードに Shape が 1 つも
 * 無ければ場面を置く（Shape があるボードには勝手に置かない。HUD の「場面を置き直す」で置く）。
 */
export function createCompare3dPlugin(
	scene: Compare3dScene,
	renderer: "css" | "gpu",
): UsketchPlugin {
	return {
		id: "usketch-web-compare-3d",
		name: "3D 比較",
		setup(ctx: PluginContext) {
			let result = "";
			let running = false;
			const listeners = new Set<() => void>();
			const notify = () => {
				for (const l of listeners) l();
			};
			// ボードの読み込み（ローカル保存・同期）を待ってから置く。
			const timer = setTimeout(() => {
				if (ctx.store.getShapes().size === 0) placeCompare3dScene(ctx, scene);
			}, 800);

			const run = async () => {
				if (running) return;
				running = true;
				result = "測っています…（15 秒ほど。ほかの操作はしないでください）";
				notify();
				try {
					const r = await measure3d(ctx, scene, renderer);
					result = formatCompare3dResult(r);
					console.info("[compare-3d]", JSON.stringify(r));
					(window as unknown as { __compare3dResult?: Compare3dResult }).__compare3dResult = r;
				} catch (err) {
					result = `失敗しました: ${String(err)}`;
				} finally {
					running = false;
					notify();
				}
			};

			const offs = [
				ctx.actions.register({
					id: "compare-3d:measure",
					label: "フレーム時間を測る",
					group: "3D 比較",
					order: 0,
					run,
					isEnabled: () => !running,
				}),
				ctx.actions.register({
					id: "compare-3d:place",
					label: "場面を置き直す",
					group: "3D 比較",
					order: 1,
					run: () => placeCompare3dScene(ctx, scene),
				}),
				ctx.actions.register({
					id: "compare-3d:switch",
					label: renderer === "gpu" ? "CSS 3D で開き直す" : "GPU で開き直す",
					group: "3D 比較",
					order: 2,
					run: () => {
						window.location.search = otherRendererSearch(window.location.search, renderer);
					},
				}),
				ctx.hud.registerPanel({
					id: "compare-3d:result",
					title: "3D 比較",
					render: () => (
						<Compare3dPanel
							label={`${renderer === "gpu" ? "GPU" : "CSS 3D"} / ${SCENE_LABELS[scene]}`}
							read={() => result}
							subscribe={(l) => {
								listeners.add(l);
								return () => listeners.delete(l);
							}}
						/>
					),
				}),
			];
			return () => {
				clearTimeout(timer);
				for (const off of offs) off();
				listeners.clear();
			};
		},
	};
}

function Compare3dPanel(props: {
	label: string;
	read: () => string;
	subscribe: (listener: () => void) => () => void;
}) {
	const text = useSyncExternalStore(props.subscribe, props.read);
	return (
		<div style={{ fontSize: 12, lineHeight: 1.5 }}>
			<div>{props.label}</div>
			{text ? (
				<pre style={{ whiteSpace: "pre-wrap", userSelect: "text", margin: "4px 0 0" }}>{text}</pre>
			) : (
				<div style={{ opacity: 0.7 }}>「フレーム時間を測る」で 15 秒ほど測ります。</div>
			)}
		</div>
	);
}
