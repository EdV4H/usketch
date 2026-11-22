import type {
	ActionRegistry,
	BoardStore,
	EventBus,
	HudPanel,
	HudRegistry,
	PermissionProvider,
	PluginAction,
	PluginInfoRegistry,
	ShapeStyle,
	ToolRegistry,
} from "@edv4h/usketch-shared";
import type React from "react";
import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from "react";
import {
	collapseAll,
	type DockPrefsStore,
	isOpen,
	isPinned,
	toggleOpen,
	togglePinned,
} from "../dock-prefs-store.js";
import {
	bucketSize,
	buildPluginBuckets,
	type PluginBucket,
	partitionPinned,
} from "../plugin-buckets.js";
import { STOP_CANVAS_PROPAGATION } from "../stop-propagation.js";
import {
	ACCENT,
	INLINE_INPUT,
	MINI_BUTTON,
	MINI_BUTTON_ACCENT,
	PANEL_BASE,
	PANEL_BG,
	TEXT_LABEL,
	TEXT_MUTED,
} from "../styles.js";
import { defaultArgs, ParamInputWidget } from "./param-input.js";
import { SettingsGroup } from "./settings-control.js";

/** Expanded / collapsed dock widths (kept in sync with DebugHud's sibling offset). */
export const CONTROLS_DOCK_WIDTH = 248;
export const CONTROLS_DOCK_COLLAPSED = 30;

/** Section keys for the dock's built-in (non-plugin) sections. */
export const BUILTIN_SECTION = {
	tools: "@tools",
	shapes: "@shapes",
	emit: "@emit",
	style: "@style",
} as const;

interface ControlsPanelProps {
	store: BoardStore;
	tools: ToolRegistry;
	actions: ActionRegistry;
	hud: HudRegistry;
	plugins: PluginInfoRegistry;
	events: EventBus;
	activeToolId: string;
	collapsed: boolean;
	onToggleCollapsed: () => void;
	/** Persisted open / pinned state of the dock's sections. */
	prefs: DockPrefsStore;
	/** The shapes inspector, rendered as a section inside the dock. */
	shapesSection?: React.ReactNode;
	/** What the viewer may do; controls whose `requires` it denies are hidden. */
	permissions?: PermissionProvider;
}

/**
 * Universal control dock. Drives plugin operations without any demo-app UI: a
 * tool palette (`tools.getOrdered()`), the declarative action registry, a raw
 * event-emit fallback, and default-style controls. Full-height, collapsible.
 *
 * Plugin sections start collapsed so the dock stays short as plugins grow;
 * open / pinned state persists via {@link DockPrefsStore}. Pinned plugins are
 * listed first, and a search query force-expands every matching section.
 */
export function ControlsPanel({
	store,
	tools,
	actions,
	hud,
	plugins,
	events,
	activeToolId,
	collapsed,
	onToggleCollapsed,
	prefs: prefsStore,
	shapesSection,
	permissions,
}: ControlsPanelProps) {
	// Re-render when actions or HUD contributions register/unregister at runtime.
	const [, bump] = useReducer((n: number) => n + 1, 0);
	useEffect(() => actions.subscribe(bump), [actions]);
	useEffect(() => hud.subscribe(bump), [hud]);
	// …and when what the viewer may do changes (role changed, invited…).
	useEffect(() => permissions?.subscribe(bump), [permissions]);

	const subscribePrefs = useCallback((cb: () => void) => prefsStore.subscribe(cb), [prefsStore]);
	const getPrefs = useCallback(() => prefsStore.get(), [prefsStore]);
	const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);

	// Filter over plugin controls (plugin name / action / settings / panel).
	const [query, setQuery] = useState("");

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
	const q = query.trim().toLowerCase();
	const searching = q !== "";
	const buckets = buildPluginBuckets(actions, hud, plugins, q, permissions);
	const { pinned, rest } = partitionPinned(buckets, prefs.pinned);
	const totalActions = actions.getAll().size;

	const sectionProps = (key: string) => ({
		open: isOpen(prefs, key),
		onToggle: () => prefsStore.update((p) => toggleOpen(p, key)),
	});

	const renderBucket = (bucket: PluginBucket) => (
		<Section
			key={bucket.pluginId}
			title={bucket.name}
			count={bucketSize(bucket)}
			{...sectionProps(bucket.pluginId)}
			forceOpen={searching}
			pinned={isPinned(prefs, bucket.pluginId)}
			onTogglePin={() => prefsStore.update((p) => togglePinned(p, bucket.pluginId))}
		>
			{bucket.settings.map((descriptor) => (
				<SettingsGroup key={descriptor.id} descriptor={descriptor} />
			))}
			{[...bucket.actionGroups.entries()].map(([group, items]) => (
				<div key={group}>
					{group !== "" && <div style={subGroupStyle}>{group}</div>}
					{items.map((action) => (
						<ActionRow key={action.id} action={action} onAfterRun={bump} />
					))}
				</div>
			))}
			{bucket.panels.map((panel) =>
				panel.placement === "side" ? (
					<SidePanelOpener key={panel.id} panel={panel} hud={hud} />
				) : (
					<PanelSlot key={panel.id} panel={panel} />
				),
			)}
		</Section>
	);

	const anyPluginOpen = buckets.some((b) => isOpen(prefs, b.pluginId));

	return (
		<div {...STOP_CANVAS_PROPAGATION} style={dockStyle}>
			{/* Header + search stay pinned to the top while the dock scrolls. */}
			<div style={stickyTopStyle}>
				<div style={headerStyle}>
					<span style={{ color: ACCENT, fontWeight: 700 }}>Controls</span>
					<div style={{ display: "flex", gap: 4 }}>
						<button
							type="button"
							onClick={() =>
								prefsStore.update((p) =>
									collapseAll(
										p,
										buckets.map((b) => b.pluginId),
									),
								)
							}
							disabled={!anyPluginOpen}
							style={{ ...MINI_BUTTON, opacity: anyPluginOpen ? 1 : 0.4 }}
							title="プラグインのセクションをすべて閉じる"
						>
							⊟
						</button>
						<button type="button" onClick={onToggleCollapsed} style={MINI_BUTTON} title="Collapse">
							‹
						</button>
					</div>
				</div>
				<div style={{ position: "relative" }}>
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape" && query !== "") {
								e.stopPropagation();
								setQuery("");
							}
						}}
						placeholder="プラグイン / 操作を検索…"
						style={{ ...INLINE_INPUT, width: "100%", boxSizing: "border-box", paddingRight: 18 }}
					/>
					{query !== "" && (
						<button
							type="button"
							onClick={() => setQuery("")}
							style={clearButtonStyle}
							title="検索をクリア"
						>
							×
						</button>
					)}
				</div>
			</div>

			<Section title="Tools" {...sectionProps(BUILTIN_SECTION.tools)}>
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

			{pinned.length > 0 && <div style={groupLabelStyle}>★ Pinned</div>}
			{pinned.map(renderBucket)}

			{rest.length > 0 && <div style={groupLabelStyle}>Plugins · {rest.length}</div>}
			{rest.map(renderBucket)}

			{buckets.length === 0 && (
				<div style={{ color: TEXT_MUTED, fontSize: 10, marginTop: 10 }}>
					{totalActions === 0 && hud.getSettings().length === 0 && hud.getPanels().length === 0 ? (
						<>
							No plugin controls. Plugins expose these via <code>ctx.actions.register</code> /{" "}
							<code>ctx.hud</code>.
						</>
					) : (
						"一致するコントロールがありません"
					)}
				</div>
			)}

			{shapesSection && (
				<Section title="Shapes" {...sectionProps(BUILTIN_SECTION.shapes)}>
					{shapesSection}
				</Section>
			)}

			<Section title="Emit event" {...sectionProps(BUILTIN_SECTION.emit)}>
				<EventConsole events={events} />
			</Section>

			<Section title="Style" {...sectionProps(BUILTIN_SECTION.style)}>
				<StyleControls store={store} />
			</Section>
		</div>
	);
}

/**
 * Collapsible section with a clickable header. Controlled: open state lives in
 * the persisted {@link DockPrefsStore}. `forceOpen` (used while searching)
 * shows the body regardless; `onTogglePin` adds a ☆/★ pin toggle.
 */
function Section({
	title,
	count,
	open,
	onToggle,
	forceOpen = false,
	pinned,
	onTogglePin,
	children,
}: {
	title: string;
	count?: number;
	open: boolean;
	onToggle: () => void;
	forceOpen?: boolean;
	pinned?: boolean;
	onTogglePin?: () => void;
	children: React.ReactNode;
}) {
	const shown = open || forceOpen;
	return (
		<div style={sectionStyle}>
			<div style={{ display: "flex", alignItems: "center", gap: 4 }}>
				<button
					type="button"
					onClick={forceOpen ? undefined : onToggle}
					style={{ ...sectionHeaderStyle, cursor: forceOpen ? "default" : "pointer" }}
					title={forceOpen ? undefined : shown ? "Collapse" : "Expand"}
					aria-expanded={shown}
				>
					<span style={{ color: ACCENT, marginRight: 6, fontSize: 8 }}>{shown ? "▼" : "▶"}</span>
					<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
						{title}
					</span>
					{count !== undefined && <span style={countBadgeStyle}>{count}</span>}
				</button>
				{onTogglePin && (
					<button
						type="button"
						onClick={onTogglePin}
						style={{ ...pinButtonStyle, color: pinned ? "#fbbf24" : TEXT_MUTED }}
						title={pinned ? "ピンを外す" : "ピン留め（上部に固定）"}
						aria-pressed={pinned}
					>
						{pinned ? "★" : "☆"}
					</button>
				)}
			</div>
			{shown && <div style={sectionBodyStyle}>{children}</div>}
		</div>
	);
}

/** Render a plugin-provided custom panel, isolating render errors. */
/** A side panel shows in the side panel, not in the dock: the dock gets a button to open it. */
function SidePanelOpener({ panel, hud }: { panel: HudPanel; hud: HudRegistry }) {
	const open = hud.getOpenSidePanel?.() === panel.id;
	return (
		<button
			type="button"
			onClick={() => hud.toggleSidePanel?.(panel.id)}
			style={{ ...(open ? MINI_BUTTON_ACCENT : MINI_BUTTON), marginBottom: 4 }}
		>
			{open ? "▾" : "▸"} {panel.title ?? panel.id}
		</button>
	);
}

function PanelSlot({ panel }: { panel: HudPanel }) {
	try {
		return (
			<div style={{ marginBottom: 4 }}>
				{panel.title && <div style={subGroupStyle}>{panel.title}</div>}
				{panel.render()}
			</div>
		);
	} catch (err) {
		console.error(`HUD panel "${panel.id}" failed to render:`, err);
		return <div style={{ color: "#f87171", fontSize: 10 }}>panel error: {panel.id}</div>;
	}
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
					<ParamInputWidget
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
	marginBottom: 6,
	fontSize: 11,
};

// ドック本体の padding(10) 分だけ上に食い込ませ、スクロール中も上端に貼り付ける。
const stickyTopStyle: React.CSSProperties = {
	position: "sticky",
	top: -10,
	zIndex: 1,
	margin: "-10px -10px 0",
	padding: "10px 10px 6px",
	background: PANEL_BG,
	borderRadius: "8px 8px 0 0",
};

const clearButtonStyle: React.CSSProperties = {
	position: "absolute",
	right: 2,
	top: "50%",
	transform: "translateY(-50%)",
	background: "transparent",
	border: "none",
	color: TEXT_MUTED,
	cursor: "pointer",
	fontSize: 11,
	lineHeight: 1,
	padding: "0 3px",
};

// 「★ Pinned」「Plugins · N」の区切りラベル。
const groupLabelStyle: React.CSSProperties = {
	marginTop: 12,
	color: TEXT_MUTED,
	fontSize: 9,
	fontWeight: 600,
	letterSpacing: 0.6,
	textTransform: "uppercase",
};

const countBadgeStyle: React.CSSProperties = {
	marginLeft: 6,
	flexShrink: 0,
	color: TEXT_MUTED,
	fontSize: 9,
	fontWeight: 400,
	letterSpacing: 0,
};

const pinButtonStyle: React.CSSProperties = {
	flexShrink: 0,
	background: "transparent",
	border: "none",
	cursor: "pointer",
	padding: "0 2px",
	fontSize: 11,
	lineHeight: 1,
};

// セクションごとに区切り線 + 上マージンを付けて境界を明確にする。
// プラグインが多くても畳んだ状態で一覧しやすいよう、間隔は詰め気味にする。
const sectionStyle: React.CSSProperties = {
	marginTop: 4,
	paddingTop: 4,
	borderTop: "1px solid rgba(255, 255, 255, 0.1)",
};

// ヘッダーは大文字 + トラッキング + やや明るい色でスキャンしやすくする。
const sectionHeaderStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	flex: 1,
	minWidth: 0,
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

// Sub-heading for an action `group` within a plugin section (and panel titles).
const subGroupStyle: React.CSSProperties = {
	color: TEXT_MUTED,
	fontSize: 9,
	fontWeight: 600,
	letterSpacing: 0.4,
	textTransform: "uppercase",
	margin: "4px 0 2px",
};

const swatchLabel: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 3,
	color: TEXT_LABEL,
	fontSize: 10,
};
