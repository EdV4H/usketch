import type {
	CommandRegistry,
	EventBus,
	ShapeData,
	ShapeDefinition,
	ShapeRegistry,
	ToolContext,
} from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";

/** テスト用の最小 ShapeDefinition（bounds は素直に x/y/w/h を返す）。 */
function stubDef(type: string): ShapeDefinition {
	return {
		render: () => null as never,
		getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
		hitTest: () => false,
		resize: (s) => s,
		createDefault: ({ id, x, y }) => ({
			id,
			type,
			x,
			y,
			width: 100,
			height: 80,
			style: { fill: "#fff", stroke: "#000", strokeWidth: 2, opacity: 1 },
		}),
	};
}

function stubShapes(types: string[]): ShapeRegistry {
	const map = new Map<string, ShapeDefinition>();
	for (const t of types) map.set(t, stubDef(t));
	return {
		register: (t, d) => map.set(t, d),
		get: (t) => map.get(t),
		getAll: () => map,
	};
}

function stubCommands(): CommandRegistry {
	const undos: { undo(): void }[] = [];
	let redos: { execute(): void; undo(): void }[] = [];
	return {
		execute(cmd) {
			cmd.execute();
			undos.push(cmd);
			redos = [];
		},
		undo() {
			const cmd = undos.pop();
			if (cmd) {
				cmd.undo();
				redos.push(cmd as never);
			}
		},
		redo() {
			const cmd = redos.pop();
			if (cmd) {
				cmd.execute();
				undos.push(cmd);
			}
		},
		canUndo: () => undos.length > 0,
		canRedo: () => redos.length > 0,
		getHistorySize: () => undos.length,
		getCursor: () => undos.length,
	};
}

export interface StubEvents extends EventBus {
	emitted: { event: string; data: unknown }[];
}

function stubEvents(): StubEvents {
	const emitted: { event: string; data: unknown }[] = [];
	return {
		emitted,
		on: () => () => {},
		emit: (event: string, data: unknown) => {
			emitted.push({ event, data });
		},
		pause: () => {},
		resume: () => {},
		isPaused: () => false,
	} as StubEvents;
}

export interface TestDeps extends ToolContext {
	events: StubEvents;
}

/** テスト用の deps（実 store + スタブ registry/commands/events）。 */
export function makeDeps(shapeTypes: string[] = ["rectangle", "sticky"]): TestDeps {
	return {
		store: createBoardStore(),
		shapes: stubShapes(shapeTypes),
		commands: stubCommands(),
		events: stubEvents(),
	};
}

/** store に矩形を1つ追加してその id を返す。 */
export function addRect(deps: ToolContext, x: number, y: number, w = 100, h = 80): string {
	const id = `s_${x}_${y}`;
	const shape: ShapeData = {
		id,
		type: "rectangle",
		x,
		y,
		width: w,
		height: h,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 2, opacity: 1 },
	};
	deps.store.addShape(shape);
	return id;
}
