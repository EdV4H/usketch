import type { HistoryCommitTrigger, ShapeData } from "@edv4h/usketch-shared";
import type React from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { HistoryCommitSummary, HistoryDiff } from "./history-client.js";
import type { HistoryController } from "./history-controller.js";
import { shortHash } from "./history-ops.js";

const ACCENT = "var(--u-1)";
const tint = (v: string, pct: number) => `color-mix(in srgb, ${v} ${pct}%, transparent)`;
// The Control HUD draws its own (dark) surface whatever the app theme, so text and
// lines derive from the inherited text color instead of the app's fg/border tokens.
const MUTED = tint("currentColor", 55);
const SECONDARY = tint("currentColor", 75);
const LINE = tint("currentColor", 25);
const LINE_SUBTLE = tint("currentColor", 15);

const TRIGGER_LABEL: Record<HistoryCommitTrigger, string> = {
	auto: "自動",
	manual: "手動",
	restore: "復元",
};

/** How many changed shapes the diff lists before collapsing into "+N more". */
const DIFF_LIST_LIMIT = 8;

function formatTime(iso: string): string {
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shapeLabel(shape: ShapeData): string {
	const text = (shape as unknown as { text?: unknown }).text;
	const name = typeof text === "string" && text.trim() ? ` 「${text.trim().slice(0, 16)}」` : "";
	return `${shape.type}${name}`;
}

/** The Control HUD panel: version list, diff against the current board, preview and restore. */
export function HistoryPanel({ controller }: { controller: HistoryController }) {
	const state = useSyncExternalStore(
		controller.subscribe,
		controller.getState,
		controller.getState,
	);
	const [message, setMessage] = useState("");

	useEffect(() => {
		void controller.refresh();
	}, [controller]);

	return (
		<div style={wrapStyle}>
			<div style={rowStyle}>
				<input
					style={inputStyle}
					value={message}
					placeholder="版の名前（任意）"
					maxLength={500}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !state.loading) {
							void controller.saveVersion(message).then((c) => c && setMessage(""));
						}
					}}
				/>
				<button
					type="button"
					style={primaryBtnStyle}
					disabled={state.loading}
					onClick={() => void controller.saveVersion(message).then((c) => c && setMessage(""))}
				>
					保存
				</button>
				<button
					type="button"
					style={btnStyle}
					disabled={state.loading}
					title="再読み込み"
					onClick={() => void controller.refresh()}
				>
					↻
				</button>
			</div>

			{state.previewing && (
				<div style={previewStyle}>
					<span>プレビュー中: {shortHash(state.previewing)}（編集は反映されません）</span>
					<button type="button" style={btnStyle} onClick={() => controller.exitPreview()}>
						終了
					</button>
				</div>
			)}
			{state.error && <div style={errorStyle}>⚠ {state.error}</div>}
			{state.notice && <div style={noticeStyle}>{state.notice}</div>}

			{state.commits.length === 0 && !state.loading ? (
				<div style={emptyStyle}>まだ履歴がありません。編集すると数分ごとに自動で保存されます。</div>
			) : (
				<div style={listStyle}>
					{state.commits.map((commit) => (
						<CommitRow
							key={commit.hash}
							commit={commit}
							isHead={commit.hash === state.head}
							selected={commit.hash === state.selected}
							diff={commit.hash === state.selected ? state.diff : null}
							loading={state.loading}
							controller={controller}
						/>
					))}
				</div>
			)}

			{state.nextCursor && (
				<button
					type="button"
					style={btnStyle}
					disabled={state.loading}
					onClick={() => void controller.loadMore()}
				>
					もっと見る
				</button>
			)}
		</div>
	);
}

function CommitRow({
	commit,
	isHead,
	selected,
	diff,
	loading,
	controller,
}: {
	commit: HistoryCommitSummary;
	isHead: boolean;
	selected: boolean;
	diff: HistoryDiff | null;
	loading: boolean;
	controller: HistoryController;
}) {
	const [confirming, setConfirming] = useState(false);
	const { added, removed, modified } = commit.stats;

	return (
		<div style={selected ? selectedCardStyle : cardStyle}>
			<button
				type="button"
				style={rowButtonStyle}
				onClick={() => {
					setConfirming(false);
					void controller.select(commit.hash);
				}}
			>
				<span style={timeStyle}>{formatTime(commit.createdAt)}</span>
				<span style={badgeStyle(commit.trigger)}>{TRIGGER_LABEL[commit.trigger]}</span>
				<span style={messageStyle}>{commit.message || shortHash(commit.hash)}</span>
				<span style={statsStyle}>
					{added > 0 && <span style={{ color: "var(--success)" }}>+{added} </span>}
					{removed > 0 && <span style={{ color: "var(--danger)" }}>−{removed} </span>}
					{modified > 0 && <span>~{modified}</span>}
					{isHead && <span style={headStyle}> 最新</span>}
				</span>
			</button>

			{selected && (
				<div style={detailStyle}>
					{diff ? <DiffSummary diff={diff} /> : <div style={emptyStyle}>差分を読み込み中…</div>}
					<div style={rowStyle}>
						<button
							type="button"
							style={btnStyle}
							disabled={loading}
							onClick={() => void controller.preview(commit.hash)}
						>
							プレビュー
						</button>
						{confirming ? (
							<button
								type="button"
								style={dangerBtnStyle}
								disabled={loading}
								onClick={() => {
									setConfirming(false);
									void controller.restore(commit.hash);
								}}
							>
								本当に戻す
							</button>
						) : (
							<button
								type="button"
								style={primaryBtnStyle}
								disabled={loading || isEmptyDiff(diff)}
								onClick={() => setConfirming(true)}
							>
								この版に戻す
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function isEmptyDiff(diff: HistoryDiff | null): boolean {
	return diff !== null && diff.added.length + diff.removed.length + diff.modified.length === 0;
}

/**
 * What restoring would do. The diff is "commit → current board", so a shape
 * `added` since the commit is removed by a restore, and a `removed` one comes back.
 */
function DiffSummary({ diff }: { diff: HistoryDiff }) {
	if (isEmptyDiff(diff)) return <div style={emptyStyle}>今のボードと同じです</div>;
	const lines: { key: string; mark: string; color: string; text: string }[] = [
		...diff.removed.map((s) => ({
			key: `r:${s.id}`,
			mark: "＋",
			color: "var(--success)",
			text: `${shapeLabel(s)} が戻る`,
		})),
		...diff.added.map((s) => ({
			key: `a:${s.id}`,
			mark: "−",
			color: "var(--danger)",
			text: `${shapeLabel(s)} が消える`,
		})),
		...diff.modified.map((m) => ({
			key: `m:${m.id}`,
			mark: "~",
			color: SECONDARY,
			text: `${shapeLabel(m.after)}: ${m.changes.map((c) => c.key).join(", ")}`,
		})),
	];
	return (
		<div style={diffStyle}>
			<div style={diffHeadStyle}>
				この版に戻すと: 戻る {diff.removed.length} / 消える {diff.added.length} / 変わる{" "}
				{diff.modified.length}
			</div>
			{lines.slice(0, DIFF_LIST_LIMIT).map((line) => (
				<div key={line.key} style={diffLineStyle}>
					<span style={{ color: line.color, width: 10, flex: "none" }}>{line.mark}</span>
					<span style={ellipsisStyle}>{line.text}</span>
				</div>
			))}
			{lines.length > DIFF_LIST_LIMIT && (
				<div style={emptyStyle}>ほか {lines.length - DIFF_LIST_LIMIT} 件</div>
			)}
		</div>
	);
}

// ── styles (HUD compact scale; theme-aware tokens) ──

const wrapStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	fontSize: 10,
	color: "inherit",
};
const rowStyle: React.CSSProperties = { display: "flex", gap: 4, alignItems: "center" };
const listStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 4,
	maxHeight: 360,
	overflowY: "auto",
};
const emptyStyle: React.CSSProperties = { color: MUTED, fontSize: 10 };
const inputStyle: React.CSSProperties = {
	flex: 1,
	minWidth: 0,
	padding: "3px 6px",
	border: `1px solid ${LINE}`,
	borderRadius: "var(--r-xs)",
	background: "transparent",
	color: "inherit",
	font: "inherit",
	fontSize: 10,
};
const btnStyle: React.CSSProperties = {
	padding: "3px 8px",
	border: `1px solid ${LINE}`,
	borderRadius: "var(--r-xs)",
	background: "transparent",
	color: "inherit",
	cursor: "pointer",
	font: "inherit",
	fontSize: 10,
	whiteSpace: "nowrap",
};
const primaryBtnStyle: React.CSSProperties = {
	...btnStyle,
	border: `1px solid ${ACCENT}`,
	background: tint(ACCENT, 12),
	color: ACCENT,
};
const dangerBtnStyle: React.CSSProperties = {
	...btnStyle,
	border: "1px solid var(--danger)",
	background: tint("var(--danger)", 14),
	color: "var(--danger)",
};
const errorStyle: React.CSSProperties = {
	color: "var(--danger)",
	background: tint("var(--danger)", 14),
	border: `1px solid ${tint("var(--danger)", 40)}`,
	borderRadius: "var(--r-xs)",
	padding: "3px 6px",
};
const noticeStyle: React.CSSProperties = {
	background: tint(ACCENT, 10),
	border: `1px solid ${tint(ACCENT, 30)}`,
	borderRadius: "var(--r-xs)",
	padding: "3px 6px",
};
const previewStyle: React.CSSProperties = {
	...noticeStyle,
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 6,
};
const cardStyle: React.CSSProperties = {
	border: `1px solid ${LINE_SUBTLE}`,
	borderRadius: "var(--r-xs)",
};
const selectedCardStyle: React.CSSProperties = { ...cardStyle, borderColor: ACCENT };
const rowButtonStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 6,
	width: "100%",
	padding: "4px 6px",
	border: "none",
	background: "transparent",
	color: "inherit",
	cursor: "pointer",
	font: "inherit",
	fontSize: 10,
	textAlign: "left",
};
const timeStyle: React.CSSProperties = {
	color: MUTED,
	fontVariantNumeric: "tabular-nums",
	flex: "none",
};
function badgeStyle(trigger: HistoryCommitTrigger): React.CSSProperties {
	const color = trigger === "manual" ? ACCENT : MUTED;
	return {
		flex: "none",
		padding: "0 4px",
		borderRadius: "var(--r-xs)",
		border: `1px solid ${tint(color, 50)}`,
		color,
		fontSize: 9,
	};
}
const ellipsisStyle: React.CSSProperties = {
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	minWidth: 0,
};
const messageStyle: React.CSSProperties = { ...ellipsisStyle, flex: 1 };
const statsStyle: React.CSSProperties = {
	flex: "none",
	color: SECONDARY,
	fontVariantNumeric: "tabular-nums",
};
const headStyle: React.CSSProperties = { color: ACCENT };
const detailStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	padding: "4px 6px 6px",
	borderTop: `1px solid ${LINE_SUBTLE}`,
};
const diffStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const diffHeadStyle: React.CSSProperties = { color: SECONDARY };
const diffLineStyle: React.CSSProperties = { display: "flex", gap: 4, alignItems: "baseline" };
