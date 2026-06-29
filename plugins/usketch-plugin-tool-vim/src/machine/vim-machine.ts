import type { Point } from "@edv4h/usketch-shared";
import { assign, enqueueActions, setup } from "xstate";
import { computeCandidates } from "../candidates.js";
import { runExCommand } from "../commands.js";
import {
	allShapesCenter,
	findDirectionalNearest,
	findNearestShape,
	moveCursorBy,
	shapeCenter,
	snapToGrid,
} from "../cursor.js";
import type { VimApi } from "../extensions.js";
import { computeHopTargets } from "../hop.js";
import { centerViewportOn, screenCenterWorld } from "../viewport-utils.js";
import {
	commitCandidate,
	deleteShapes,
	effectiveCount,
	pasteShapes,
	resolveTargets,
	snapshotShapes,
} from "./actions.js";
import type { Direction, VimContext, VimEvent, VimInput, VimMode } from "./types.js";

type Ev<T extends VimEvent["type"]> = Extract<VimEvent, { type: T }>;

/** VimMode を対応するモード遷移イベントに変換（normal は ESCAPE）。 */
function modeEvent(mode: VimMode): VimEvent {
	switch (mode) {
		case "insert":
			return { type: "MODE_INSERT" };
		case "visual":
			return { type: "MODE_VISUAL", multi: false };
		case "command":
			return { type: "MODE_COMMAND" };
		case "hop":
			return { type: "HOP_START" };
		default:
			return { type: "ESCAPE" };
	}
}

/**
 * 拡張ハンドラに渡す {@link VimApi} を組み立てる。カーソル/モード/メッセージは
 * `apply.*`（enqueue 経由）で machine 状態へ反映し、ハンドラ内の getter には
 * 直近の値を返す。store/shapes/commands/events は実サービスへの直接参照。
 */
function buildVimApi(
	context: VimContext,
	mode: VimMode,
	apply: { setCursor(p: Point): void; message(m: string): void; raise(e: VimEvent): void },
): VimApi {
	let liveCursor = context.cursor;
	let liveMode = mode;
	return {
		store: context.deps.store,
		shapes: context.deps.shapes,
		commands: context.deps.commands,
		events: context.deps.events,
		getCursor: () => liveCursor,
		getMode: () => liveMode,
		getSelection: () => context.deps.store.getSelection(),
		setCursor(p) {
			liveCursor = p;
			apply.setCursor(p);
		},
		setMode(m) {
			liveMode = m;
			apply.raise(modeEvent(m));
		},
		message(msg) {
			apply.message(msg);
		},
	};
}

/** カーソル候補座標をスナップ設定に従って整える。 */
function maybeSnap(ctx: VimContext, p: { x: number; y: number }) {
	return ctx.config.snapToGrid ? snapToGrid(p, ctx.config.gridSize) : p;
}

/**
 * 画角を `dir` 方向へ `count` 段 pan し、論理カーソルを「画面上の同じ位置」に
 * 留めるための新 world 座標を返す（pan の逆方向に world を補正）。
 */
function panAndFollowCursor(ctx: VimContext, dir: Direction, count: number): Point {
	const step = ctx.config.panStep * count;
	const dx = dir === "left" ? step : dir === "right" ? -step : 0;
	const dy = dir === "up" ? step : dir === "down" ? -step : 0;
	ctx.deps.store.panBy(dx, dy);
	const zoom = ctx.deps.store.getViewport().zoom || 1;
	return { x: ctx.cursor.x - dx / zoom, y: ctx.cursor.y - dy / zoom };
}

export const vimMachine = setup({
	types: {
		context: {} as VimContext,
		events: {} as VimEvent,
		input: {} as VimInput,
	},
	guards: {
		isShiftMotion: ({ event }) => (event as Ev<"MOTION">).shift === true,
		isMultiVisual: ({ event }) => (event as Ev<"MODE_VISUAL">).multi === true,
		hasCandidates: ({ context }) => context.candidates.length > 0,
	},
	actions: {
		incCount: assign(({ context, event }) => ({
			count: (context.count ?? 0) * 10 + (event as Ev<"DIGIT">).n,
		})),
		resetCount: assign({ count: null }),

		// normal: 小文字 hjkl → カーソル移動 / 大文字 HJKL → 画角 pan
		normalMotion: enqueueActions(({ context, event, enqueue }) => {
			const e = event as Ev<"MOTION">;
			const n = effectiveCount(context);
			if (e.shift) {
				// 画角 pan + カーソル追従（画面上の位置を維持）
				enqueue.assign({ cursor: panAndFollowCursor(context, e.dir, n) });
			} else {
				const next = maybeSnap(
					context,
					moveCursorBy(context.cursor, e.dir, context.config.cursorStep * n),
				);
				enqueue.assign({ cursor: next });
			}
			enqueue.assign({ count: null });
		}),

		selectNearest: enqueueActions(({ context, enqueue }) => {
			const id = findNearestShape(context.deps, context.cursor);
			if (id) {
				context.deps.store.setSelection([id]);
				const c = shapeCenter(context.deps, id);
				if (c) enqueue.assign({ cursor: c });
			}
		}),

		visualSingleMotion: enqueueActions(({ context, event, enqueue }) => {
			const e = event as Ev<"MOTION">;
			if (e.shift) {
				enqueue.assign({ cursor: panAndFollowCursor(context, e.dir, effectiveCount(context)) });
				enqueue.assign({ count: null });
				return;
			}
			const sel = context.deps.store.getSelection();
			const next = findDirectionalNearest(context.deps, context.cursor, e.dir, sel);
			if (next) {
				context.deps.store.setSelection([next]);
				const c = shapeCenter(context.deps, next);
				if (c) enqueue.assign({ cursor: c });
			}
			enqueue.assign({ count: null });
		}),

		visualMultiMotion: enqueueActions(({ context, event, enqueue }) => {
			const e = event as Ev<"MOTION">;
			if (e.shift) {
				enqueue.assign({ cursor: panAndFollowCursor(context, e.dir, effectiveCount(context)) });
				enqueue.assign({ count: null });
				return;
			}
			const sel = context.deps.store.getSelection();
			const next = findDirectionalNearest(context.deps, context.cursor, e.dir, sel);
			if (next) {
				context.deps.store.addToSelection(next);
				const c = shapeCenter(context.deps, next);
				if (c) enqueue.assign({ cursor: c });
			}
			enqueue.assign({ count: null });
		}),

		clearSelection: ({ context }) => context.deps.store.clearSelection(),

		deleteTargets: ({ context }) => {
			const nearest = findNearestShape(context.deps, context.cursor);
			deleteShapes(context.deps, resolveTargets(context, nearest));
			context.deps.store.clearSelection();
		},
		yankTargets: assign(({ context }) => {
			const nearest = findNearestShape(context.deps, context.cursor);
			return { register: snapshotShapes(context.deps, resolveTargets(context, nearest)) };
		}),
		paste: ({ context }) => {
			const ids = pasteShapes(context);
			if (ids.length > 0) context.deps.store.setSelection(ids);
		},

		// insert
		appendInput: assign(({ context, event }) => {
			const buffer = context.inputBuffer + (event as Ev<"TEXT">).char;
			return {
				inputBuffer: buffer,
				candidates: computeCandidates(context.deps, context.config, buffer),
				candidateIndex: 0,
			};
		}),
		backspaceInput: assign(({ context }) => {
			const buffer = context.inputBuffer.slice(0, -1);
			return {
				inputBuffer: buffer,
				candidates: computeCandidates(context.deps, context.config, buffer),
				candidateIndex: 0,
			};
		}),
		cycleCandidate: assign(({ context, event }) => {
			const len = context.candidates.length;
			if (len === 0) return {};
			const dir = (event as Ev<"TAB">).shift ? -1 : 1;
			return { candidateIndex: (context.candidateIndex + dir + len) % len };
		}),
		commit: assign(({ context }) => {
			commitCandidate(context);
			// 確定後はバッファをクリアして連続入力可能に。
			return { inputBuffer: "", candidates: [], candidateIndex: 0 };
		}),
		resetInsert: assign({ inputBuffer: "", candidates: [], candidateIndex: 0 }),

		// command
		appendCommand: assign(({ context, event }) => ({
			commandBuffer: context.commandBuffer + (event as Ev<"COMMAND_CHAR">).char,
		})),
		backspaceCommand: assign(({ context }) => ({
			commandBuffer: context.commandBuffer.slice(0, -1),
		})),
		runCommand: enqueueActions(({ context, enqueue }) => {
			const line = context.commandBuffer.trim();
			enqueue.assign({ commandBuffer: "" });
			if (line === "") return;
			const [name, ...args] = line.split(/\s+/);
			// 独自コマンドが組み込みより優先される。
			const custom = context.extensions.commands?.[name];
			if (custom) {
				const api = buildVimApi(context, "command", {
					setCursor: (p) => enqueue.assign({ cursor: p }),
					message: (m) => enqueue.assign({ lastMessage: m }),
					raise: (e) => enqueue.raise(e),
				});
				const msg = custom(args, api);
				if (typeof msg === "string") enqueue.assign({ lastMessage: msg });
				return;
			}
			const result = runExCommand(line, context.deps, context.config);
			enqueue.assign({
				lastMessage: result.message,
				helpVisible: result.toggleHelp ? !context.helpVisible : context.helpVisible,
				cursor: result.cursorCenter
					? maybeSnap(context, screenCenterWorld(context.deps.store))
					: context.cursor,
			});
		}),
		runCustomBinding: enqueueActions(({ context, event, enqueue }) => {
			const e = event as Ev<"CUSTOM_BINDING">;
			const handler = context.extensions.bindings?.[e.mode]?.[e.key];
			if (!handler) return;
			const api = buildVimApi(context, e.mode, {
				setCursor: (p) => enqueue.assign({ cursor: p }),
				message: (m) => enqueue.assign({ lastMessage: m }),
				raise: (ev) => enqueue.raise(ev),
			});
			handler(api);
		}),
		resetCommand: assign({ commandBuffer: "" }),

		// misc
		zoom: ({ context, event }) => {
			const e = event as Ev<"ZOOM">;
			const vp = context.deps.store.getViewport();
			const factor = context.config.zoomStep;
			const z = e.dir === "in" ? vp.zoom * factor : vp.zoom / factor;
			context.deps.store.zoomTo(z, screenCenterWorld(context.deps.store));
		},
		center: ({ context }) => {
			centerViewportOn(context.deps.store, context.cursor);
		},
		cursorCenter: assign(({ context }) => ({
			cursor: maybeSnap(context, screenCenterWorld(context.deps.store)),
		})),

		// hop（ラベルジャンプ）
		hopStart: assign(({ context }) => ({
			hopLabels: computeHopTargets(context.deps, context.cursor, context.config.hopKeys),
			hopBuffer: "",
		})),
		hopKey: enqueueActions(({ context, event, enqueue }) => {
			const char = (event as Ev<"HOP_KEY">).char;
			const buffer = context.hopBuffer + char;
			const matches = context.hopLabels.filter((l) => l.label.startsWith(buffer));
			if (matches.length === 0) {
				// マッチ無し: 入力をリセットしてやり直し
				enqueue.assign({ hopBuffer: "" });
				return;
			}
			const exact = matches.find((l) => l.label === buffer);
			if (exact && matches.length === 1) {
				// 一意確定: カーソルをジャンプして hop を抜ける（exit で hop 状態はクリア）
				enqueue.assign({ cursor: { x: exact.cx, y: exact.cy } });
				enqueue.raise({ type: "ESCAPE" });
				return;
			}
			enqueue.assign({ hopBuffer: buffer });
		}),
		clearHop: assign({ hopLabels: [], hopBuffer: "" }),
		jump: enqueueActions(({ context, event, enqueue }) => {
			const to = (event as Ev<"JUMP">).to;
			const sorted = context.deps.store.getShapesSorted();
			const shape = to === "first" ? sorted[0] : sorted[sorted.length - 1];
			const target = shape ? shapeCenter(context.deps, shape.id) : allShapesCenter(context.deps);
			if (target) enqueue.assign({ cursor: target });
		}),
		undo: ({ context }) => context.deps.commands.undo(),
		redo: ({ context }) => context.deps.commands.redo(),
		setMark: assign(({ context, event }) => ({
			marks: { ...context.marks, [(event as Ev<"SET_MARK">).key]: { ...context.cursor } },
		})),
		jumpMark: assign(({ context, event }) => {
			const mark = context.marks[(event as Ev<"JUMP_MARK">).key];
			return mark ? { cursor: { ...mark } } : {};
		}),
		toggleWhichKey: assign(({ context }) => ({ whichKeyVisible: !context.whichKeyVisible })),
		closeHelp: assign({ helpVisible: false }),
	},
}).createMachine({
	id: "vim",
	context: ({ input }) => ({
		cursor: input.initialCursor,
		count: null,
		pendingOperator: null,
		inputBuffer: "",
		commandBuffer: "",
		candidates: [],
		candidateIndex: 0,
		register: [],
		marks: {},
		whichKeyVisible: false,
		helpVisible: false,
		hopLabels: [],
		hopBuffer: "",
		lastMessage: null,
		config: input.config,
		deps: input.deps,
		extensions: input.extensions,
	}),
	initial: "normal",
	on: {
		CUSTOM_BINDING: { actions: "runCustomBinding" },
		RESET: {
			target: ".normal",
			actions: assign(({ event }) => ({
				cursor: (event as Ev<"RESET">).cursor,
				count: null,
				pendingOperator: null,
				inputBuffer: "",
				commandBuffer: "",
				candidates: [],
				candidateIndex: 0,
			})),
		},
	},
	states: {
		normal: {
			on: {
				DIGIT: { actions: "incCount" },
				MOTION: { actions: "normalMotion" },
				MODE_INSERT: { target: "insert" },
				MODE_VISUAL: [
					{ guard: "isMultiVisual", target: "visual.multi" },
					{ target: "visual.single" },
				],
				MODE_COMMAND: { target: "command" },
				OPERATOR: [
					{
						guard: ({ event }) => (event as Ev<"OPERATOR">).op === "delete",
						actions: ["deleteTargets", "resetCount"],
					},
					{ actions: ["yankTargets", "resetCount"] },
				],
				PASTE: { actions: ["paste", "resetCount"] },
				UNDO: { actions: "undo" },
				REDO: { actions: "redo" },
				ZOOM: { actions: "zoom" },
				CENTER: { actions: "center" },
				CURSOR_CENTER: { actions: "cursorCenter" },
				JUMP: { actions: "jump" },
				SET_MARK: { actions: "setMark" },
				JUMP_MARK: { actions: "jumpMark" },
				HOP_START: { target: "hop" },
				TOGGLE_WHICH_KEY: { actions: "toggleWhichKey" },
				ESCAPE: { actions: ["clearSelection", "resetCount", "closeHelp"] },
			},
		},
		insert: {
			exit: "resetInsert",
			on: {
				TEXT: { actions: "appendInput" },
				BACKSPACE: { actions: "backspaceInput" },
				TAB: { actions: "cycleCandidate" },
				COMMIT: { guard: "hasCandidates", actions: "commit" },
				ESCAPE: { target: "normal" },
			},
		},
		visual: {
			entry: "selectNearest",
			exit: "clearSelection",
			on: {
				DIGIT: { actions: "incCount" },
				ESCAPE: { target: "normal" },
				MODE_COMMAND: { target: "command" },
				OPERATOR: [
					{
						guard: ({ event }) => (event as Ev<"OPERATOR">).op === "delete",
						target: "normal",
						actions: ["deleteTargets", "resetCount"],
					},
					{ target: "normal", actions: ["yankTargets", "resetCount"] },
				],
				PASTE: { actions: ["paste", "resetCount"] },
			},
			initial: "single",
			states: {
				single: {
					on: {
						MOTION: { actions: "visualSingleMotion" },
						MODE_VISUAL: { guard: "isMultiVisual", target: "multi" },
					},
				},
				multi: {
					on: {
						MOTION: { actions: "visualMultiMotion" },
					},
				},
			},
		},
		command: {
			// entry でのみクリア。exit でクリアすると XState の実行順
			// (exit → transition action) により runCommand が読む前に空になるため不可。
			// runCommand 自身も commandBuffer を空に戻す。
			entry: "resetCommand",
			on: {
				COMMAND_CHAR: { actions: "appendCommand" },
				COMMAND_BACKSPACE: { actions: "backspaceCommand" },
				RUN_COMMAND: { target: "normal", actions: "runCommand" },
				ESCAPE: { target: "normal" },
			},
		},
		hop: {
			entry: "hopStart",
			exit: "clearHop",
			on: {
				HOP_KEY: { actions: "hopKey" },
				ESCAPE: { target: "normal" },
			},
		},
	},
});
