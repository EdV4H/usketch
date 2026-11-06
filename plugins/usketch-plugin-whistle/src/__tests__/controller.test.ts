import type { BoardStore, Viewport } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWhistleController, type WhistleControllerDeps } from "../controller.js";

const SIZE = { width: 1000, height: 800 };

function fakeStore(initial: Viewport = { x: 0, y: 0, zoom: 1 }) {
	let viewport = initial;
	const listeners = new Set<() => void>();
	const moves: { target: Viewport; animate?: boolean; durationMs?: number }[] = [];
	const store = {
		getViewport: () => viewport,
		animateViewportTo: (target: Viewport, opts?: { animate?: boolean; durationMs?: number }) => {
			moves.push({ target, ...opts });
			viewport = target;
			for (const fn of listeners) fn();
		},
		subscribe: (fn: () => void) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
	} as unknown as BoardStore;
	const setViewport = (vp: Viewport) => {
		viewport = vp;
		for (const fn of listeners) fn();
	};
	return { store, moves, setViewport };
}

function setup(overrides: Partial<WhistleControllerDeps> = {}) {
	const s = fakeStore();
	const sent: Record<string, unknown>[] = [];
	let n = 0;
	const controller = createWhistleController({
		store: s.store,
		broadcast: (msg) => sent.push(msg),
		getLocalName: () => "Me",
		getScreenSize: () => SIZE,
		generateId: () => `id-${++n}`,
		...overrides,
	});
	return { ...s, sent, controller };
}

// 画面中央 (500, 400) が world (0, 0) から十分遠い場所。
const FAR = { x: 5000, y: 5000 };

const blowMsg = (whistleKind: string | undefined, extra: Record<string, unknown> = {}) => ({
	kind: "whistle",
	id: `remote-${whistleKind ?? "legacy"}`,
	whistleKind,
	sourceUserId: "u2",
	sourceName: "Alice",
	position: FAR,
	zoom: 2,
	...extra,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("blow", () => {
	it("画面中央の位置と種類を載せて broadcast し、クールダウンに入る", () => {
		const { controller, sent } = setup();
		expect(controller.blow("gather")).toBe(true);
		expect(sent).toEqual([
			expect.objectContaining({
				kind: "whistle",
				whistleKind: "gather",
				sourceName: "Me",
				position: { x: 500, y: 400 },
				zoom: 1,
			}),
		]);
		expect(controller.state.get().sent?.kind).toBe("gather");
		vi.advanceTimersByTime(1000);
		expect(controller.blow("call")).toBe(false);
		// 吹けなかったことを残り時間つきで伝える。broadcast はしない。
		expect(controller.state.get().sent).toMatchObject({ kind: "call", cooldownRemainingMs: 4000 });
		expect(sent).toHaveLength(1);
		vi.advanceTimersByTime(4000);
		expect(controller.blow("call")).toBe(true);
	});

	it("種類を省略すると選択中の種類で吹く", () => {
		const { controller, sent } = setup();
		controller.setSelectedKind("assemble");
		controller.blow();
		expect(sent[0]?.whistleKind).toBe("assemble");
	});
});

describe("受信: 種類ごとの移動", () => {
	it("おーい: 移動せず、画面外なら方向バッジを出す。押すと移動", () => {
		const { controller, moves } = setup();
		controller.receive(blowMsg("call"));
		const s = controller.state.get();
		expect(s.pulses).toHaveLength(1);
		expect(s.indicators).toHaveLength(1);
		expect(moves).toHaveLength(0);
		controller.jumpToIndicator(s.indicators[0]?.id ?? "");
		expect(moves).toHaveLength(1);
		vi.advanceTimersByTime(5000);
		expect(controller.state.get().indicators).toHaveLength(0);
	});

	it("おーい: 画面内なら方向バッジは出さない", () => {
		const { controller } = setup();
		controller.receive(blowMsg("call", { position: { x: 100, y: 100 } }));
		expect(controller.state.get().indicators).toHaveLength(0);
	});

	it("kind なしの旧メッセージはおーい扱い", () => {
		const { controller } = setup();
		controller.receive(blowMsg(undefined));
		expect(controller.state.get().indicators).toHaveLength(1);
		expect(controller.state.get().prompt).toBeNull();
	});

	it("集合: プロンプトを出し、承諾で吹いた人のズームで移動する", () => {
		const { controller, moves } = setup();
		controller.receive(blowMsg("gather"));
		expect(controller.state.get().prompt?.kind).toBe("gather");
		expect(moves).toHaveLength(0);
		controller.acceptPrompt();
		expect(controller.state.get().prompt).toBeNull();
		expect(moves[0]?.target.zoom).toBe(2);
	});

	it("集合: 期限が来るとプロンプトは消える", () => {
		const { controller } = setup();
		controller.receive(blowMsg("gather"));
		vi.advanceTimersByTime(10000);
		expect(controller.state.get().prompt).toBeNull();
	});

	it("全員集合: カウントダウン後に自動で移動する (遠いので引いてから寄る)", () => {
		const { controller, moves } = setup();
		controller.receive(blowMsg("assemble"));
		expect(controller.state.get().countdown).not.toBeNull();
		vi.advanceTimersByTime(3000);
		expect(controller.state.get().countdown).toBeNull();
		expect(moves).toHaveLength(1);
		expect(moves[0]?.target.zoom).toBeLessThan(1);
		vi.advanceTimersByTime(450);
		expect(moves).toHaveLength(2);
		expect(moves[1]?.target.zoom).toBe(2);
	});

	it("全員集合: 残るを押せば移動しない", () => {
		const { controller, moves } = setup();
		controller.receive(blowMsg("assemble"));
		controller.stayCountdown();
		vi.advanceTimersByTime(5000);
		expect(moves).toHaveLength(0);
	});

	it("全員集合: 強制移動を受けられないときは承諾制に落ちる", () => {
		const { controller, moves } = setup({ canAutoMove: () => false });
		controller.receive(blowMsg("assemble"));
		expect(controller.state.get().countdown).toBeNull();
		expect(controller.state.get().prompt?.kind).toBe("assemble");
		vi.advanceTimersByTime(3000);
		expect(moves).toHaveLength(0);
	});

	it("動き方の差し替え: 集合を自動にするとカウントダウンになる", () => {
		const { controller } = setup({ movements: { gather: "auto" } });
		controller.receive(blowMsg("gather"));
		expect(controller.state.get().prompt).toBeNull();
		expect(controller.state.get().countdown).not.toBeNull();
	});

	it("カメラの動かし方の差し替え: 理由と行き先を渡し、次の移動の前に止める", () => {
		const cancel = vi.fn();
		const moveCamera = vi.fn(() => cancel);
		const { controller, moves } = setup({ moveCamera });
		controller.receive(blowMsg("assemble"));
		vi.advanceTimersByTime(3000);
		expect(moveCamera).toHaveBeenLastCalledWith(
			expect.objectContaining({ reason: "auto", kind: "assemble", target: FAR, zoom: 2 }),
		);
		expect(moves).toHaveLength(0);
		controller.receive(blowMsg("gather"));
		controller.acceptPrompt();
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(moveCamera).toHaveBeenLastCalledWith(
			expect.objectContaining({ reason: "accept", kind: "gather", animate: true }),
		);
	});

	it("全員集合が来たら古い集合プロンプトは消える", () => {
		const { controller } = setup();
		controller.receive(blowMsg("gather"));
		controller.receive(blowMsg("assemble"));
		expect(controller.state.get().prompt).toBeNull();
		expect(controller.state.get().countdown).not.toBeNull();
	});

	it("同じ id は二度処理しない", () => {
		const { controller } = setup();
		controller.receive(blowMsg("gather"));
		controller.dismissPrompt();
		controller.receive(blowMsg("gather"));
		expect(controller.state.get().prompt).toBeNull();
	});

	it("reduced motion なら移動をアニメーションしない", () => {
		const { controller, moves } = setup({ prefersReducedMotion: () => true });
		controller.receive(blowMsg("assemble"));
		vi.advanceTimersByTime(3000);
		expect(moves).toEqual([expect.objectContaining({ animate: false })]);
	});
});

describe("ついてきて", () => {
	it("follower: 吹いた人のカメラに追従し、自分で操作すると外れて戻らない", () => {
		const { controller, moves } = setup();
		controller.receive(blowMsg("follow"));
		expect(controller.state.get().follow).toEqual({
			id: "remote-follow",
			role: "follower",
			name: "Alice",
		});
		const follow = (x: number) => ({
			kind: "whistle-follow",
			id: "remote-follow",
			sourceUserId: "u2",
			sourceName: "Alice",
			center: { x, y: 0 },
			zoom: 1,
		});
		controller.receive(follow(100));
		// 画面中央 (500, 400) に world (100, 0) が来る。
		expect(moves.at(-1)?.target).toEqual({ x: 400, y: 400, zoom: 1 });

		controller.notifyUserInteraction();
		expect(controller.state.get().follow).toBeNull();
		const count = moves.length;
		controller.receive(follow(200));
		expect(moves).toHaveLength(count);
	});

	it("follower: 終了メッセージで解散する", () => {
		const { controller } = setup();
		controller.receive(blowMsg("follow"));
		controller.receive({ kind: "whistle-follow-end", id: "remote-follow" });
		expect(controller.state.get().follow).toBeNull();
	});

	it("leader: 画角が変わると間引いて流し、もう一度吹くと終える", () => {
		const { controller, sent, setViewport } = setup();
		controller.blow("follow");
		expect(controller.state.get().follow?.role).toBe("leader");
		setViewport({ x: -100, y: 0, zoom: 1 });
		setViewport({ x: -200, y: 0, zoom: 1 });
		vi.advanceTimersByTime(80);
		const updates = sent.filter((m) => m.kind === "whistle-follow");
		expect(updates).toHaveLength(1);
		expect(updates[0]?.center).toEqual({ x: 700, y: 400 });

		// クールダウン中でも、案内中の「ついてきて」は終了として通る。
		expect(controller.blow("follow")).toBe(true);
		expect(controller.state.get().follow).toBeNull();
		expect(sent.at(-1)).toEqual({ kind: "whistle-follow-end", id: "id-1" });
	});

	it("強制移動を受けられないときは承諾制で、承諾すると追従を始める", () => {
		const { controller } = setup({ canAutoMove: () => false });
		controller.receive(blowMsg("follow"));
		expect(controller.state.get().follow).toBeNull();
		expect(controller.state.get().prompt?.kind).toBe("follow");
		controller.acceptPrompt();
		expect(controller.state.get().follow?.role).toBe("follower");
	});

	it("follower: 自分で画角を動かすと (入力の種類を問わず) 外れる", () => {
		const { controller, setViewport } = setup();
		controller.receive(blowMsg("follow"));
		vi.advanceTimersByTime(700); // 入りのアニメーションが終わるまで待つ
		setViewport({ x: 1, y: 2, zoom: 1 });
		expect(controller.state.get().follow).toBeNull();
	});

	it("follower: 案内役から何も届かなくなったら追従をやめる", () => {
		const { controller } = setup();
		controller.receive(blowMsg("follow"));
		vi.advanceTimersByTime(8000);
		expect(controller.state.get().follow).toBeNull();
	});

	it("leader: 画角が止まっていても連番付きで生存を知らせる", () => {
		const { controller, sent } = setup();
		controller.blow("follow");
		vi.advanceTimersByTime(4000);
		const beats = sent.filter((m) => m.kind === "whistle-follow");
		expect(beats.map((m) => m.seq)).toEqual([1, 2]);
	});

	it("dispose で案内中なら終了を流す", () => {
		const { controller, sent } = setup();
		controller.blow("follow");
		controller.dispose();
		expect(sent.at(-1)).toEqual({ kind: "whistle-follow-end", id: "id-1" });
	});
});
