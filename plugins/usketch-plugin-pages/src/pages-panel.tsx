import type { PageMeta } from "@edv4h/usketch-sync";
import type React from "react";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { PagesApi } from "./pages-api.js";

const ACCENT = "var(--u-1)";
const tint = (v: string, pct: number) => `color-mix(in srgb, ${v} ${pct}%, transparent)`;
// Control HUD は自前の（暗い）面に描くので、文字と線は継いだ文字色から作る。
const MUTED = tint("currentColor", 55);
const LINE = tint("currentColor", 25);
const LINE_SUBTLE = tint("currentColor", 15);

/** ページ一覧を購読する（変わらなければ同じ配列を返す）。 */
function usePages(api: PagesApi): { live: PageMeta[]; deleted: PageMeta[] } {
	const cache = useRef<{ key: string; value: { live: PageMeta[]; deleted: PageMeta[] } } | null>(
		null,
	);
	const read = useCallback(() => {
		const live = api.list();
		const deleted = api.listDeleted();
		const key = JSON.stringify([live, deleted]);
		if (cache.current?.key !== key) cache.current = { key, value: { live, deleted } };
		return cache.current.value;
	}, [api]);
	return useSyncExternalStore(api.subscribe, read, read);
}

function formatDate(ms: number | undefined): string {
	if (ms === undefined) return "";
	const d = new Date(ms);
	return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** HUD のページパネル: 一覧・切り替え・追加・名前変更・並べ替え・複製・削除・復元。 */
export function PagesPanel({ api }: { api: PagesApi }) {
	const { live, deleted } = usePages(api);
	const [editing, setEditing] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const [showDeleted, setShowDeleted] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const run = (fn: () => unknown) => {
		setError(null);
		try {
			const result = fn();
			if (result instanceof Promise) {
				setBusy(true);
				result
					.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
					.finally(() => setBusy(false));
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	};

	const startRename = (page: PageMeta) => {
		setEditing(page.id);
		setDraft(page.name);
	};
	const commitRename = () => {
		if (editing) run(() => api.rename(editing, draft));
		setEditing(null);
	};

	return (
		<div style={wrapStyle}>
			<ul style={listStyle} aria-label="ページ">
				{live.map((page, index) => {
					const current = page.id === api.currentPageId;
					return (
						<li key={page.id} style={current ? currentRowStyle : rowStyle}>
							{editing === page.id ? (
								<input
									style={inputStyle}
									value={draft}
									maxLength={100}
									aria-label="ページ名"
									// biome-ignore lint/a11y/noAutofocus: 名前変更を始めたら入力欄に移る
									autoFocus
									onChange={(e) => setDraft(e.target.value)}
									onBlur={commitRename}
									onKeyDown={(e) => {
										if (e.key === "Enter") commitRename();
										else if (e.key === "Escape") setEditing(null);
										e.stopPropagation();
									}}
								/>
							) : (
								<button
									type="button"
									style={nameButtonStyle}
									title={
										current ? "今のページ（ダブルクリックで名前を変える）" : "このページを開く"
									}
									aria-current={current ? "page" : undefined}
									onClick={() => api.switchTo(page.id)}
									onDoubleClick={() => startRename(page)}
								>
									<span style={indexStyle}>{index + 1}</span>
									<span style={ellipsisStyle}>{page.name || "（名前なし）"}</span>
								</button>
							)}
							{confirmDelete === page.id ? (
								<>
									<button
										type="button"
										style={dangerBtnStyle}
										onClick={() => {
											setConfirmDelete(null);
											run(() => api.delete(page.id));
										}}
									>
										削除する
									</button>
									<button type="button" style={btnStyle} onClick={() => setConfirmDelete(null)}>
										やめる
									</button>
								</>
							) : (
								<span style={toolsStyle}>
									<button
										type="button"
										style={iconBtnStyle}
										title="名前を変える"
										aria-label={`${page.name} の名前を変える`}
										onClick={() => startRename(page)}
									>
										✎
									</button>
									<button
										type="button"
										style={iconBtnStyle}
										title="上へ"
										aria-label={`${page.name} を上へ`}
										disabled={index === 0}
										onClick={() => run(() => api.move(page.id, -1))}
									>
										↑
									</button>
									<button
										type="button"
										style={iconBtnStyle}
										title="下へ"
										aria-label={`${page.name} を下へ`}
										disabled={index === live.length - 1}
										onClick={() => run(() => api.move(page.id, 1))}
									>
										↓
									</button>
									{api.canDuplicate && (
										<button
											type="button"
											style={iconBtnStyle}
											title="複製"
											aria-label={`${page.name} を複製`}
											disabled={busy}
											onClick={() => run(() => api.duplicate(page.id, { open: true }))}
										>
											⧉
										</button>
									)}
									<button
										type="button"
										style={iconBtnStyle}
										title={api.canDelete(page.id) ? "削除" : "最後のページは削除できません"}
										aria-label={`${page.name} を削除`}
										disabled={!api.canDelete(page.id)}
										onClick={() => setConfirmDelete(page.id)}
									>
										🗑
									</button>
								</span>
							)}
						</li>
					);
				})}
			</ul>
			<button
				type="button"
				style={primaryBtnStyle}
				onClick={() => run(() => api.create({ open: true }))}
			>
				＋ ページを追加
			</button>
			{error && <div style={errorStyle}>{error}</div>}
			{deleted.length > 0 && (
				<div style={deletedWrapStyle}>
					<button type="button" style={linkBtnStyle} onClick={() => setShowDeleted((v) => !v)}>
						{showDeleted ? "▾" : "▸"} 削除したページ（{deleted.length}）
					</button>
					{showDeleted &&
						deleted.map((page) => (
							<div key={page.id} style={rowStyle}>
								<span style={{ ...ellipsisStyle, flex: 1, color: MUTED }}>
									{page.name || "（名前なし）"}
								</span>
								<span style={dateStyle}>{formatDate(page.deletedAt)}</span>
								<button
									type="button"
									style={btnStyle}
									onClick={() => run(() => api.restore(page.id))}
								>
									戻す
								</button>
							</div>
						))}
				</div>
			)}
		</div>
	);
}

const wrapStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	fontSize: 10,
	color: "inherit",
};
const listStyle: React.CSSProperties = {
	listStyle: "none",
	margin: 0,
	padding: 0,
	display: "flex",
	flexDirection: "column",
	gap: 2,
	maxHeight: 320,
	overflowY: "auto",
};
const rowStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 4,
	padding: "2px 4px",
	border: `1px solid ${LINE_SUBTLE}`,
	borderRadius: "var(--r-xs)",
};
const currentRowStyle: React.CSSProperties = {
	...rowStyle,
	borderColor: ACCENT,
	background: tint(ACCENT, 10),
};
const nameButtonStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 6,
	flex: 1,
	minWidth: 0,
	padding: "2px 2px",
	border: "none",
	background: "transparent",
	color: "inherit",
	cursor: "pointer",
	font: "inherit",
	textAlign: "left",
};
const indexStyle: React.CSSProperties = {
	flex: "none",
	minWidth: 14,
	color: MUTED,
	fontVariantNumeric: "tabular-nums",
};
const ellipsisStyle: React.CSSProperties = {
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	minWidth: 0,
};
const toolsStyle: React.CSSProperties = { display: "flex", gap: 2, flex: "none" };
const inputStyle: React.CSSProperties = {
	flex: 1,
	minWidth: 0,
	padding: "2px 6px",
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
const iconBtnStyle: React.CSSProperties = {
	...btnStyle,
	padding: "1px 5px",
	border: "1px solid transparent",
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
const linkBtnStyle: React.CSSProperties = {
	...btnStyle,
	border: "none",
	padding: "2px 0",
	color: MUTED,
	textAlign: "left",
};
const deletedWrapStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const dateStyle: React.CSSProperties = {
	color: MUTED,
	fontVariantNumeric: "tabular-nums",
	flex: "none",
};
const errorStyle: React.CSSProperties = {
	color: "var(--danger)",
	background: tint("var(--danger)", 14),
	border: `1px solid ${tint("var(--danger)", 40)}`,
	borderRadius: "var(--r-xs)",
	padding: "3px 6px",
};
