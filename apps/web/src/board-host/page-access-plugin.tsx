/**
 * デモの「公開範囲」HUD パネル。今のページを誰が見られるか・編集できるかと、招いた人を出す。
 * ページを管理できる人（作った人・ボードの owner など）は変えられ、ほかの人は読むだけ。
 *
 * 読み書きは {@link PageAccessControl}（board-permissions.ts。サーバーの REST を呼ぶ）がする。
 * パネルはそれを呼ぶだけ。
 */
import type {
	DemoPageAccess,
	PageEditPolicy,
	PageMemberRole,
	PageVisibility,
} from "@edv4h/usketch-demo-permissions";
import { PERMISSIONS, permissionsOf, type UsketchPlugin } from "@edv4h/usketch-shared";
import type React from "react";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { PageAccessControl } from "./board-permissions.js";

export const PAGE_ACCESS_PLUGIN_ID = "demo-page-access";

const VISIBILITY_LABELS: Record<PageVisibility, string> = {
	public: "ボードを見られる人全員",
	members: "ボードのメンバー",
	private: "作った人と招いた人だけ",
};

const EDIT_LABELS: Record<PageEditPolicy, string> = {
	members: "ボードの編集者と招いた編集者",
	invited: "作った人と招いた編集者",
	"owner-only": "作った人だけ",
};

const ROLE_LABELS: Record<PageMemberRole, string> = {
	editor: "編集できる",
	viewer: "見るだけ",
};

/** 見られる人の説明（公開ボードの公開ページはログインしていない人も見られる）。 */
export function visibilityLabel(visibility: PageVisibility, boardPublic: boolean): string {
	if (visibility === "public" && boardPublic) return "誰でも（ログインしていない人も）";
	return VISIBILITY_LABELS[visibility];
}

/** API のエラーを、パネルに出す言葉にする。 */
export function describeAccessError(e: unknown, action: "set" | "invite" | "remove"): string {
	const status = /API error: (\d+)/.exec(e instanceof Error ? e.message : "")?.[1];
	if (action === "invite" && status === "404") return "そのメールアドレスの人が見つかりません";
	if (status === "403") return "このページの公開範囲を変える権限がありません";
	return action === "set"
		? "公開範囲を変えられませんでした"
		: action === "invite"
			? "招けませんでした"
			: "外せませんでした";
}

interface Snapshot {
	access: DemoPageAccess;
	boardPublic: boolean;
	canManage: boolean;
}

function PageAccessPanel({
	control,
	pageId,
	canManage,
	subscribePermissions,
}: {
	control: PageAccessControl;
	pageId: string;
	canManage: () => boolean;
	subscribePermissions: (listener: () => void) => () => void;
}) {
	const cache = useRef<{ key: string; value: Snapshot } | null>(null);
	const read = useCallback((): Snapshot => {
		const value = {
			access: control.get(pageId).access,
			boardPublic: control.boardPublic(),
			canManage: canManage(),
		};
		const key = JSON.stringify(value);
		if (cache.current?.key !== key) cache.current = { key, value };
		return cache.current.value;
	}, [control, pageId, canManage]);
	const subscribe = useCallback(
		(listener: () => void) => {
			const offs = [control.subscribe(listener), subscribePermissions(listener)];
			return () => {
				for (const off of offs) off();
			};
		},
		[control, subscribePermissions],
	);
	const snapshot = useSyncExternalStore(subscribe, read, read);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<PageMemberRole>("viewer");

	const run = (action: "set" | "invite" | "remove", fn: () => Promise<void>) => {
		setBusy(true);
		setError(null);
		fn()
			.catch((e: unknown) => setError(describeAccessError(e, action)))
			.finally(() => setBusy(false));
	};

	const { access, boardPublic } = snapshot;
	const members = Object.entries(access.members ?? {});

	if (!snapshot.canManage) {
		return (
			<div style={wrapStyle}>
				<dl style={summaryStyle}>
					<dt style={{ color: MUTED }}>見られる人</dt>
					<dd style={ddStyle}>{visibilityLabel(access.visibility, boardPublic)}</dd>
					<dt style={{ color: MUTED }}>編集できる人</dt>
					<dd style={ddStyle}>{EDIT_LABELS[access.edit]}</dd>
				</dl>
				<div style={{ color: MUTED }}>
					公開範囲は、ページを作った人とボードの owner が変えられます。
				</div>
			</div>
		);
	}

	const setAccess = (next: Partial<Pick<DemoPageAccess, "visibility" | "edit">>) =>
		run("set", () =>
			control.set(pageId, {
				visibility: next.visibility ?? access.visibility,
				edit: next.edit ?? access.edit,
			}),
		);

	return (
		<div style={wrapStyle}>
			<label style={fieldStyle}>
				<span style={{ color: MUTED }}>見られる人</span>
				<select
					style={selectStyle}
					value={access.visibility}
					disabled={busy}
					onChange={(e) => setAccess({ visibility: e.target.value as PageVisibility })}
				>
					{(Object.keys(VISIBILITY_LABELS) as PageVisibility[]).map((v) => (
						<option key={v} value={v}>
							{visibilityLabel(v, boardPublic)}
						</option>
					))}
				</select>
			</label>
			<label style={fieldStyle}>
				<span style={{ color: MUTED }}>編集できる人</span>
				<select
					style={selectStyle}
					value={access.edit}
					disabled={busy}
					onChange={(e) => setAccess({ edit: e.target.value as PageEditPolicy })}
				>
					{(Object.keys(EDIT_LABELS) as PageEditPolicy[]).map((v) => (
						<option key={v} value={v}>
							{EDIT_LABELS[v]}
						</option>
					))}
				</select>
			</label>
			{access.visibility === "private" && (
				<div style={{ color: MUTED }}>
					名前も、見られない人には出しません（ページパネルにも出ません）。
				</div>
			)}

			<div style={sectionStyle}>
				<div style={{ color: MUTED }}>招いた人</div>
				{members.length === 0 ? (
					<div style={{ color: MUTED }}>まだいません</div>
				) : (
					<ul style={listStyle} aria-label="招いた人">
						{members.map(([userId, memberRole]) => {
							const person = control.person(userId);
							return (
								<li key={userId} style={rowStyle}>
									<span style={ellipsisStyle} title={person?.email ?? userId}>
										{person?.name ?? userId}
									</span>
									<span style={{ color: MUTED, flex: "none" }}>{ROLE_LABELS[memberRole]}</span>
									<button
										type="button"
										style={iconBtnStyle}
										disabled={busy}
										aria-label={`${person?.name ?? userId} を外す`}
										onClick={() => run("remove", () => control.remove(pageId, userId))}
									>
										×
									</button>
								</li>
							);
						})}
					</ul>
				)}
				<form
					style={rowStyle}
					onSubmit={(e) => {
						e.preventDefault();
						const address = email.trim();
						if (!address) return;
						run("invite", async () => {
							await control.invite(pageId, address, role);
							setEmail("");
						});
					}}
				>
					<input
						type="email"
						style={inputStyle}
						placeholder="メールアドレス"
						aria-label="招く人のメールアドレス"
						value={email}
						disabled={busy}
						onChange={(e) => setEmail(e.target.value)}
					/>
					<select
						style={{ ...selectStyle, flex: "none" }}
						aria-label="招く人の役割"
						value={role}
						disabled={busy}
						onChange={(e) => setRole(e.target.value as PageMemberRole)}
					>
						<option value="viewer">{ROLE_LABELS.viewer}</option>
						<option value="editor">{ROLE_LABELS.editor}</option>
					</select>
					<button type="submit" style={primaryBtnStyle} disabled={busy || !email.trim()}>
						招く
					</button>
				</form>
			</div>
			{error && (
				<div style={errorStyle} role="alert">
					{error}
				</div>
			)}
		</div>
	);
}

/** 今のページの「公開範囲」パネルを HUD に出すプラグイン。 */
export function createPageAccessPlugin(options: {
	pageId: string;
	control: PageAccessControl;
}): UsketchPlugin {
	return {
		id: PAGE_ACCESS_PLUGIN_ID,
		name: "公開範囲",
		setup(ctx) {
			const permissions = permissionsOf(ctx);
			const canManage = () => permissions.can(PERMISSIONS.pageManage, { pageId: options.pageId });
			const subscribePermissions = (listener: () => void) => permissions.subscribe(listener);
			return ctx.hud.registerPanel({
				id: `${PAGE_ACCESS_PLUGIN_ID}:panel`,
				title: "このページの公開範囲",
				render: () => (
					<PageAccessPanel
						control={options.control}
						pageId={options.pageId}
						canManage={canManage}
						subscribePermissions={subscribePermissions}
					/>
				),
			});
		},
	};
}

const ACCENT = "var(--u-1)";
const tint = (v: string, pct: number) => `color-mix(in srgb, ${v} ${pct}%, transparent)`;
// HUD は自前の（暗い）面に描くので、文字と線は継いだ文字色から作る。
const MUTED = tint("currentColor", 55);
const LINE = tint("currentColor", 25);
const LINE_SUBTLE = tint("currentColor", 15);

const wrapStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	fontSize: 10,
	color: "inherit",
};
const summaryStyle: React.CSSProperties = {
	display: "grid",
	gridTemplateColumns: "auto 1fr",
	gap: "2px 8px",
	margin: 0,
};
const ddStyle: React.CSSProperties = { margin: 0 };
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const sectionStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 4,
	paddingTop: 4,
	borderTop: `1px solid ${LINE_SUBTLE}`,
};
const listStyle: React.CSSProperties = {
	listStyle: "none",
	margin: 0,
	padding: 0,
	display: "flex",
	flexDirection: "column",
	gap: 2,
	maxHeight: 200,
	overflowY: "auto",
};
const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, margin: 0 };
const ellipsisStyle: React.CSSProperties = {
	flex: 1,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	minWidth: 0,
};
const controlStyle: React.CSSProperties = {
	padding: "2px 4px",
	border: `1px solid ${LINE}`,
	borderRadius: "var(--r-xs)",
	background: "transparent",
	color: "inherit",
	font: "inherit",
	fontSize: 10,
};
const selectStyle: React.CSSProperties = { ...controlStyle, minWidth: 0 };
const inputStyle: React.CSSProperties = {
	...controlStyle,
	flex: 1,
	minWidth: 0,
	padding: "2px 6px",
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
const errorStyle: React.CSSProperties = {
	color: "var(--danger)",
	background: tint("var(--danger)", 14),
	border: `1px solid ${tint("var(--danger)", 40)}`,
	borderRadius: "var(--r-xs)",
	padding: "3px 6px",
};
