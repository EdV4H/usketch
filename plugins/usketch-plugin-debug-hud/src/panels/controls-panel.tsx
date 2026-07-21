import type {
	ActionParam,
	ActionRegistry,
	BoardStore,
	EventBus,
	PluginAction,
	ShapeStyle,
	ToolRegistry,
} from "@edv4h/usketch-shared";
import type React from "react";
import { useEffect, useReducer, useState } from "react";
import { STOP_CANVAS_PROPAGATION } from "../stop-propagation.js";
import {
	ACCENT,
	INLINE_INPUT,
	MINI_BUTTON,
	MINI_BUTTON_ACCENT,
	PANEL_BASE,
	TEXT_LABEL,
	TEXT_MUTED,
} from "../styles.js";

/** Expanded / collapsed dock widths (kept in sync with DebugHud's sibling offset). */
export const CONTROLS_DOCK_WIDTH = 248;
export const CONTROLS_DOCK_COLLAPSED = 30;

interface ControlsPanelProps {
	store: BoardStore;
	tools: ToolRegistry;
	actions: ActionRegistry;
	events: EventBus;
	activeToolId: string;
	collapsed: boolean;
	onToggleCollapsed: () => void;
	/** The shapes inspector, rendered as a section inside the dock. */
	shapesSection?: React.ReactNode;
}

/**
 * Universal control dock. Drives plugin operations without any demo-app UI: a
 * tool palette (`tools.getOrdered()`), the declarative action registry, a raw
 * event-emit fallback, and default-style controls. Full-height, collapsible,
 * with collapsible sections.
 */
export function ControlsPanel({
	store,
	tools,
	actions,
	events,
	activeToolId,
	collapsed,
	onToggleCollapsed,
	shapesSection,
}: ControlsPanelProps) {
	// Re-render when actions register/unregister at runtime.
	const [, bump] = useReducer((n: number) => n + 1, 0);
	useEffect(() => actions.subscribe(bump), [actions]);

	// Filter over the action registry (label / group / id).
	const [actionQuery, setActionQuery] = useState("");

	if (collapsed) {
		return (
			<button
				type="button"
				{...STOP_CANVAS_PROPAGATION}
				onClick={(e) => {
					e.stopPropagation();
					onToggleCollapsed();
				}}
				style={collapsedStripStyle}
				title="Open controls"
			>
				<span style={{ writingMode: "vertical-rl", letterSpacing: 1 }}>Controls ›</span>
			</button>
		);
	}

	const toolList = tools.getOrdered();
	const actionList = actions.getOrdered();
	const q = actionQuery.trim().toLowerCase();
	const filteredActions = q
		? actionList.filter(({ action }) =>
				`${action.label} ${action.group ?? ""} ${action.id}`.toLowerCase().includes(q),
			)
		: actionList;
	const groups = groupActions(filteredActions);

	return (
		<div {...STOP_CANVAS_PROPAGATION} style={dockStyle}>
			<div style={headerStyle}>
				<span style={{ color: ACCENT, fontWeight: 700 }}>Controls</span>
				<button type="button" onClick={onToggleCollapsed} style={MINI_BUTTON} title="Collapse">
					‹
				</button>
			</div>

			<input
				value={actionQuery}
				onChange={(e) => setActionQuery(e.target.value)}
				placeholder="アクションを検索…"
				style={{ ...INLINE_INPUT, width: "100%", marginBottom: 6 }}
			/>

			<Section title="Tools">
				<div style={toolGridStyle}>
					{toolList.map(({ id, definition }) => (
						<button
							type="button"
							key={id}
							title={id}
							onClick={() => store.setActiveToolId(id)}
							style={{
								...MINI_BUTTON,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								width: 28,
								height: 28,
								background: id === activeToolId ? ACCENT : "rgba(255,255,255,0.1)",
							}}
						>
							<IconSlot render={definition.icon} />
						</button>
					))}
				</div>
			</Section>

			{groups.map(([group, items]) => (
				<Section key={group} title={group}>
					{items.map(({ id, action }) => (
						<ActionRow key={id} action={action} onAfterRun={bump} />
					))}
				</Section>
			))}
			{filteredActions.length === 0 && (
				<div style={{ color: TEXT_MUTED, fontSize: 10, marginBottom: 6 }}>
					{actionList.length === 0 ? (
						<>
							No registered actions. Plugins expose operations via <code>ctx.actions.register</code>
							.
						</>
					) : (
						"一致するアクションがありません"
					)}
				</div>
			)}

			{shapesSection && (
				<Section title="Shapes" defaultOpen={false}>
					{shapesSection}
				</Section>
			)}

			<Section title="Emit event" defaultOpen={false}>
				<EventConsole events={events} />
			</Section>

			<Section title="Style" defaultOpen={false}>
				<StyleControls store={store} />
			</Section>
		</div>
	);
}

/** Collapsible section with a clickable header. */
function Section({
	title,
	defaultOpen = true,
	children,
}: {
	title: string;
	defaultOpen?: boolean;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div style={sectionStyle}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				style={sectionHeaderStyle}
				title={open ? "Collapse" : "Expand"}
			>
				<span style={{ color: ACCENT, marginRight: 6, fontSize: 8 }}>{open ? "▼" : "▶"}</span>
				{title}
			</button>
			{open && <div style={sectionBodyStyle}>{children}</div>}
		</div>
	);
}

function groupActions(
	list: readonly { id: string; action: PluginAction }[],
): [string, { id: string; action: PluginAction }[]][] {
	const map = new Map<string, { id: string; action: PluginAction }[]>();
	for (const entry of list) {
		const g = entry.action.group ?? "Actions";
		const bucket = map.get(g) ?? [];
		bucket.push(entry);
		map.set(g, bucket);
	}
	return [...map.entries()];
}

function IconSlot({ render }: { render: () => React.ReactElement }) {
	try {
		return render();
	} catch {
		return <span>?</span>;
	}
}

/** One action: a button (no params) or inline param controls + Run. */
function ActionRow({ action, onAfterRun }: { action: PluginAction; onAfterRun: () => void }) {
	const [args, setArgs] = useState<Record<string, unknown>>(() => defaultArgs(action.params));
	const enabled = action.isEnabled ? action.isEnabled() : true;
	const active = action.isActive?.() ?? false;

	// アクション実行後に必ず親を再レンダーさせ、isActive/isEnabled を再評価する。
	// これがないと、store を変えずプラグインローカル状態だけ更新する toggle 系で
	// インジケータが次の無関係な再レンダーまで stale になる。
	// run は void | Promise<void>。同期例外・非同期 reject を握りつぶさずログし、
	// finally で onAfterRun を必ず呼んで UI 反映を保証する。
	const run = (a: Record<string, unknown>) => {
		try {
			const result = action.run(a);
			if (result && typeof (result as Promise<unknown>).then === "function") {
				(result as Promise<unknown>).catch((err) =>
					console.error(`Action "${action.id}" failed:`, err),
				);
			}
		} catch (err) {
			console.error(`Action "${action.id}" failed:`, err);
		} finally {
			onAfterRun();
		}
	};

	if (!action.params || action.params.length === 0) {
		return (
			<button
				type="button"
				disabled={!enabled}
				onClick={() => run({})}
				style={{
					...(active ? MINI_BUTTON_ACCENT : MINI_BUTTON),
					display: "block",
					width: "100%",
					textAlign: "left",
					marginBottom: 3,
					opacity: enabled ? 1 : 0.4,
				}}
			>
				{active ? "● " : ""}
				{action.label}
			</button>
		);
	}

	return (
		<div style={{ marginBottom: 4 }}>
			<div style={{ color: TEXT_LABEL, fontSize: 10 }}>{action.label}</div>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
				{action.params.map((p) => (
					<ParamControl
						key={p.name}
						param={p}
						value={args[p.name]}
						onChange={(v) => setArgs((prev) => ({ ...prev, [p.name]: v }))}
					/>
				))}
				<button
					type="button"
					disabled={!enabled}
					onClick={() => run(args)}
					style={{ ...MINI_BUTTON_ACCENT, opacity: enabled ? 1 : 0.4 }}
				>
					Run
				</button>
			</div>
		</div>
	);
}

function defaultArgs(params?: ActionParam[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const p of params ?? []) {
		if (p.default !== undefined) out[p.name] = p.default;
		else if (p.type === "enum") out[p.name] = p.options?.[0]?.value;
		else if (p.type === "boolean") out[p.name] = false;
		else if (p.type === "number") out[p.name] = p.min ?? 0;
		else if (p.type === "color") out[p.name] = "#000000";
		else out[p.name] = "";
	}
	return out;
}

function ParamControl({
	param,
	value,
	onChange,
}: {
	param: ActionParam;
	value: unknown;
	onChange: (v: unknown) => void;
}) {
	switch (param.type) {
		case "enum":
			return (
				<select
					value={String(value ?? "")}
					onChange={(e) => onChange(e.target.value)}
					style={{ ...INLINE_INPUT, width: "auto" }}
				>
					{param.options?.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			);
		case "boolean":
			return (
				<input
					type="checkbox"
					checked={Boolean(value)}
					onChange={(e) => onChange(e.target.checked)}
				/>
			);
		case "color":
			return (
				<input
					type="color"
					value={String(value ?? "#000000")}
					onChange={(e) => onChange(e.target.value)}
				/>
			);
		case "number":
			return (
				<input
					type="number"
					value={Number(value ?? 0)}
					min={param.min}
					max={param.max}
					step={param.step}
					onChange={(e) => onChange(Number(e.target.value))}
					style={INLINE_INPUT}
				/>
			);
		default:
			return (
				<input
					type="text"
					value={String(value ?? "")}
					onChange={(e) => onChange(e.target.value)}
					style={INLINE_INPUT}
				/>
			);
	}
}

/** Emit an arbitrary event with a JSON payload — the universal fallback. */
function EventConsole({ events }: { events: EventBus }) {
	const [name, setName] = useState("");
	const [payload, setPayload] = useState("{}");
	const [err, setErr] = useState<string | null>(null);

	const emit = () => {
		if (!name.trim()) return;
		let data: unknown = {};
		if (payload.trim()) {
			try {
				data = JSON.parse(payload);
			} catch {
				setErr("invalid JSON");
				return;
			}
		}
		setErr(null);
		events.emit(name.trim(), data);
	};

	return (
		<div>
			<input
				type="text"
				value={name}
				placeholder="event:name"
				onChange={(e) => setName(e.target.value)}
				style={{ ...INLINE_INPUT, width: "100%", marginBottom: 3 }}
			/>
			<textarea
				value={payload}
				onChange={(e) => setPayload(e.target.value)}
				spellCheck={false}
				style={{
					...INLINE_INPUT,
					width: "100%",
					height: 36,
					resize: "vertical",
					marginBottom: 3,
				}}
			/>
			<div style={{ display: "flex", gap: 4, alignItems: "center" }}>
				<button type="button" onClick={emit} style={MINI_BUTTON_ACCENT}>
					Emit
				</button>
				{err && <span style={{ color: "#f87171", fontSize: 10 }}>{err}</span>}
			</div>
		</div>
	);
}

/** Edit the default draw style (applies to new shapes via setStyleSettings). */
function StyleControls({ store }: { store: BoardStore }) {
	const s = store.getStyleSettings();
	// setStyleSettings はストア側で既存設定にマージする（{ ...styleSettings, ...patch }）。
	// ここで render 時点の `s` と再マージすると stale な値を書き戻し、並行変更
	// （fill 変更直後の stroke 変更など）を打ち消しかねないので patch だけ渡す。
	const set = (patch: Partial<ShapeStyle>) => store.setStyleSettings(patch);

	const clearCanvas = () => {
		const ids = [...store.getShapes().keys()];
		if (ids.length === 0) return;
		// HUD が本番でも出るようになったため、誤爆防止に確認を挟む。
		// deleteShape 直呼びは undo 履歴を通らない破壊的操作である点も明示する。
		if (
			typeof window !== "undefined" &&
			!window.confirm(`Delete all ${ids.length} shape(s)? This cannot be undone.`)
		) {
			return;
		}
		for (const id of ids) store.deleteShape(id);
	};

	return (
		<div>
			<div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
				<label style={swatchLabel}>
					fill
					<input
						type="color"
						value={toHex(s.fill)}
						onChange={(e) => set({ fill: e.target.value })}
					/>
				</label>
				<label style={swatchLabel}>
					stroke
					<input
						type="color"
						value={toHex(s.stroke)}
						onChange={(e) => set({ stroke: e.target.value })}
					/>
				</label>
			</div>
			<button
				type="button"
				onClick={clearCanvas}
				style={{ ...MINI_BUTTON, color: "#f87171", borderColor: "#f87171" }}
			>
				Clear canvas
			</button>
		</div>
	);
}

function toHex(color: unknown): string {
	return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000";
}

const dockStyle: React.CSSProperties = {
	...PANEL_BASE,
	// width must include padding so DebugHud's sibling offset (based on the
	// nominal width) actually clears the dock — otherwise content-box padding
	// makes the dock ~20px wider than expected and the minimap overlaps it.
	boxSizing: "border-box",
	position: "absolute",
	left: 8,
	top: 8,
	bottom: 8,
	width: CONTROLS_DOCK_WIDTH,
	overflowY: "auto",
};

const collapsedStripStyle: React.CSSProperties = {
	...PANEL_BASE,
	boxSizing: "border-box",
	position: "absolute",
	left: 8,
	top: 8,
	bottom: 8,
	width: CONTROLS_DOCK_COLLAPSED,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	cursor: "pointer",
	border: "none",
	color: ACCENT,
	fontSize: 11,
	fontWeight: 700,
};

const headerStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	marginBottom: 2,
	fontSize: 11,
};

// セクションごとに区切り線 + 上マージンを付けて境界を明確にする。
const sectionStyle: React.CSSProperties = {
	marginTop: 10,
	paddingTop: 10,
	borderTop: "1px solid rgba(255, 255, 255, 0.1)",
};

// ヘッダーは大文字 + トラッキング + やや明るい色でスキャンしやすくする。
const sectionHeaderStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	width: "100%",
	textAlign: "left",
	background: "transparent",
	border: "none",
	cursor: "pointer",
	padding: 0,
	margin: 0,
	fontFamily: "inherit",
	color: "#c9c9d4",
	fontSize: 10.5,
	fontWeight: 600,
	letterSpacing: 0.6,
	textTransform: "uppercase",
};

// 本文はインデント + 左のレールで「ヘッダー配下」であることを視覚化する。
const sectionBodyStyle: React.CSSProperties = {
	marginTop: 8,
	marginLeft: 3,
	paddingLeft: 9,
	borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
};

const toolGridStyle: React.CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: 4,
};

const swatchLabel: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 3,
	color: TEXT_LABEL,
	fontSize: 10,
};
