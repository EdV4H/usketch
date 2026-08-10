import type { SessionView, VotingPublicState } from "@edv4h/usketch-session-protocol";
import type React from "react";
import { useState, useSyncExternalStore } from "react";
import type { SessionClient } from "./session-client.js";

// Align with the HUD's design tokens (theme-aware CSS variables from the app
// shell) so the panel matches the surrounding Control HUD in light and dark.
const ACCENT = "var(--u-1)";
const tint = (v: string, pct: number) => `color-mix(in srgb, ${v} ${pct}%, transparent)`;

/**
 * Session panel for the Control HUD. The **server is authoritative**: every
 * button here just sends an intent (`create` / `join` / `vote` / `close`) and
 * the panel re-renders from the server-pushed {@link SessionView}. Nothing here
 * decides a tally or who won — it only draws the current public state plus this
 * client's own private receipt (which options *I* voted for).
 */
export function SessionPanel({ client, userId }: { client: SessionClient; userId: string }) {
	const state = useSyncExternalStore(client.subscribe, client.getState, client.getState);

	return (
		<div style={wrapStyle}>
			{state.error && <div style={errorStyle}>⚠ {state.error}</div>}

			{state.sessions.length === 0 ? (
				<div style={emptyStyle}>進行中のセッションはありません</div>
			) : (
				<div style={listStyle}>
					{state.sessions.map((s) =>
						s.public.type === "voting" ? (
							<VotingCard
								key={s.id}
								session={s}
								pub={s.public}
								me={userId}
								isHost={s.hostUserId === userId}
								myVotes={votesFor(state.privates[s.id])}
								onVote={(i) => client.vote(s.id, i)}
								onClose={() => client.close(s.id)}
								onEnd={() => client.end(s.id)}
							/>
						) : null,
					)}
				</div>
			)}

			<CreateVoteForm onCreate={(cfg) => client.create(cfg)} />
		</div>
	);
}

function votesFor(priv: { type: "voting"; myVotes: number[] } | undefined): number[] {
	return priv?.type === "voting" ? priv.myVotes : [];
}

/** Short, readable form of a userId for the host indicator. */
function shortId(id: string): string {
	return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

function VotingCard({
	session,
	pub,
	me,
	isHost,
	myVotes,
	onVote,
	onClose,
	onEnd,
}: {
	session: SessionView;
	pub: VotingPublicState;
	me: string;
	isHost: boolean;
	myVotes: number[];
	onVote: (optionIndex: number) => void;
	onClose: () => void;
	onEnd: () => void;
}) {
	const total = pub.tally.reduce((a, b) => a + b, 0);
	const closed = pub.status === "closed";
	const online = session.participants.filter((p) => p.connected).length;

	return (
		<div style={cardStyle}>
			<div style={cardHeadStyle}>
				<span style={questionStyle}>{pub.question}</span>
				<span style={closed ? badgeClosedStyle : badgeOpenStyle}>{closed ? "締切" : "受付中"}</span>
			</div>

			<div style={optionsStyle}>
				{pub.options.map((label, i) => {
					const count = pub.tally[i] ?? 0;
					const pct = total > 0 ? Math.round((count / total) * 100) : 0;
					const mine = myVotes.includes(i);
					return (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: option order is fixed by the server
							key={`${session.id}:${i}`}
							type="button"
							disabled={closed}
							onClick={() => onVote(i)}
							style={{
								...optionBtnStyle,
								borderColor: mine ? ACCENT : "var(--border-default)",
								cursor: closed ? "default" : "pointer",
								opacity: closed ? 0.7 : 1,
							}}
							title={pub.multi ? "複数選択可（もう一度で取消）" : "1つ選択（再選択で変更）"}
						>
							<span style={barFillStyle(pct, mine)} />
							<span style={optionLabelStyle}>
								{mine ? "● " : ""}
								{label}
							</span>
							<span style={optionCountStyle}>{count}</span>
						</button>
					);
				})}
			</div>

			<div style={metaRowStyle}>
				<span>
					{pub.secret ? "🔒秘密投票 · " : ""}
					{pub.multi ? "複数選択 · " : ""}
					{pub.totalVoters}人が投票 · {online}人接続中
				</span>
			</div>

			{isHost ? (
				closed ? (
					<button
						type="button"
						style={hostEndBtnStyle}
						onClick={onEnd}
						title="全員のパネルから削除"
					>
						🗑 終了して削除
					</button>
				) : (
					<button
						type="button"
						style={hostCloseBtnStyle}
						onClick={onClose}
						title="集計を確定して締め切る"
					>
						🛑 締め切る
					</button>
				)
			) : (
				<div style={notHostStyle}>
					締め切れるのは主催者のみです。
					<br />
					主催: <code>{shortId(session.hostUserId)}</code> ／ あなた: <code>{shortId(me)}</code>
				</div>
			)}
		</div>
	);
}

function CreateVoteForm({
	onCreate,
}: {
	onCreate: (cfg: {
		type: "voting";
		question: string;
		options: string[];
		secret: boolean;
		multi: boolean;
	}) => void;
}) {
	const [open, setOpen] = useState(false);
	const [question, setQuestion] = useState("");
	const [options, setOptions] = useState(["", "", "", ""]);
	const [secret, setSecret] = useState(false);
	const [multi, setMulti] = useState(false);

	const validOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
	const canCreate = question.trim().length > 0 && validOptions.length >= 2;

	function reset() {
		setQuestion("");
		setOptions(["", "", "", ""]);
		setSecret(false);
		setMulti(false);
	}

	if (!open) {
		return (
			<button type="button" style={newBtnStyle} onClick={() => setOpen(true)}>
				＋ 新規投票
			</button>
		);
	}

	return (
		<div style={formStyle}>
			<input
				style={inputStyle}
				placeholder="質問（例: ランチどこ行く？）"
				value={question}
				onChange={(e) => setQuestion(e.target.value)}
			/>
			{options.map((opt, i) => (
				<input
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length option slots
					key={i}
					style={inputStyle}
					placeholder={`選択肢${i + 1}${i < 2 ? "（必須）" : "（任意）"}`}
					value={opt}
					onChange={(e) => {
						const next = [...options];
						next[i] = e.target.value;
						setOptions(next);
					}}
				/>
			))}
			<label style={checkRowStyle}>
				<input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} />
				秘密投票（誰が入れたかを隠す）
			</label>
			<label style={checkRowStyle}>
				<input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
				複数選択を許可
			</label>
			<div style={formActionsStyle}>
				<button
					type="button"
					style={{ ...createBtnStyle, opacity: canCreate ? 1 : 0.5 }}
					disabled={!canCreate}
					onClick={() => {
						onCreate({
							type: "voting",
							question: question.trim(),
							options: validOptions,
							secret,
							multi,
						});
						reset();
						setOpen(false);
					}}
				>
					作成
				</button>
				<button
					type="button"
					style={cancelBtnStyle}
					onClick={() => {
						reset();
						setOpen(false);
					}}
				>
					キャンセル
				</button>
			</div>
		</div>
	);
}

// ── styles (HUD design tokens; theme-aware) ──

// Sized to the HUD's own compact scale: 10px controls, ~2–4px paddings,
// ~4px radii, matching the surrounding Timer/Portal sections.
const wrapStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	fontFamily: "var(--font-sans)",
	fontSize: 10,
	color: "var(--fg-primary)",
};
const listStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const emptyStyle: React.CSSProperties = {
	color: "var(--fg-tertiary)",
	fontSize: 10,
	padding: "2px 0",
};
const errorStyle: React.CSSProperties = {
	color: "var(--danger)",
	background: tint("var(--danger)", 14),
	border: `1px solid ${tint("var(--danger)", 40)}`,
	borderRadius: "var(--r-xs)",
	padding: "3px 6px",
	fontSize: 10,
};
const cardStyle: React.CSSProperties = {
	border: "1px solid var(--border-default)",
	borderRadius: "var(--r-sm)",
	padding: 8,
	background: "var(--bg-input)",
	display: "flex",
	flexDirection: "column",
	gap: 6,
};
const cardHeadStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 6,
};
const questionStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 600,
	color: "var(--fg-primary)",
};
const badgeOpenStyle: React.CSSProperties = {
	fontSize: 9,
	color: "var(--success)",
	background: tint("var(--success)", 16),
	borderRadius: "var(--r-pill)",
	padding: "1px 6px",
	whiteSpace: "nowrap",
};
const badgeClosedStyle: React.CSSProperties = {
	fontSize: 9,
	color: "var(--fg-tertiary)",
	background: "var(--bg-hover)",
	borderRadius: "var(--r-pill)",
	padding: "1px 6px",
	whiteSpace: "nowrap",
};
const optionsStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3 };
const optionBtnStyle: React.CSSProperties = {
	position: "relative",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 6,
	padding: "3px 8px",
	border: "1px solid var(--border-default)",
	borderRadius: "var(--r-xs)",
	background: "var(--bg-input)",
	overflow: "hidden",
	textAlign: "left",
	font: "inherit",
	fontSize: 10,
	color: "var(--fg-primary)",
};
const barFillStyle = (pct: number, mine: boolean): React.CSSProperties => ({
	position: "absolute",
	left: 0,
	top: 0,
	bottom: 0,
	width: `${pct}%`,
	background: mine ? tint(ACCENT, 28) : "var(--bg-hover)",
	transition: "width 0.3s",
	pointerEvents: "none",
});
const optionLabelStyle: React.CSSProperties = { position: "relative", zIndex: 1 };
const optionCountStyle: React.CSSProperties = {
	position: "relative",
	zIndex: 1,
	fontVariantNumeric: "tabular-nums",
	color: "var(--fg-secondary)",
	fontSize: 10,
};
const metaRowStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 6,
	fontSize: 9,
	color: "var(--fg-tertiary)",
};
const hostBtnBase: React.CSSProperties = {
	width: "100%",
	padding: "3px 8px",
	borderRadius: "var(--r-xs)",
	cursor: "pointer",
	font: "inherit",
	fontSize: 10,
	fontWeight: 600,
};
const hostCloseBtnStyle: React.CSSProperties = {
	...hostBtnBase,
	border: `1px solid ${ACCENT}`,
	background: tint(ACCENT, 14),
	color: ACCENT,
};
const hostEndBtnStyle: React.CSSProperties = {
	...hostBtnBase,
	border: `1px solid ${tint("var(--danger)", 55)}`,
	background: tint("var(--danger)", 14),
	color: "var(--danger)",
};
const notHostStyle: React.CSSProperties = {
	fontSize: 9,
	lineHeight: 1.5,
	color: "var(--fg-tertiary)",
	background: "var(--bg-hover)",
	borderRadius: "var(--r-xs)",
	padding: "4px 6px",
};
const newBtnStyle: React.CSSProperties = {
	padding: "3px 8px",
	border: `1px dashed ${ACCENT}`,
	borderRadius: "var(--r-xs)",
	background: tint(ACCENT, 8),
	color: ACCENT,
	cursor: "pointer",
	font: "inherit",
	fontSize: 10,
};
const formStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 4,
	border: "1px solid var(--border-default)",
	borderRadius: "var(--r-sm)",
	padding: 8,
	background: "var(--bg-input)",
};
const inputStyle: React.CSSProperties = {
	padding: "2px 6px",
	border: "1px solid var(--border-default)",
	borderRadius: "var(--r-xs)",
	background: "var(--bg-input)",
	color: "var(--fg-primary)",
	font: "inherit",
	fontSize: 10,
};
const checkRowStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 5,
	fontSize: 9,
	color: "var(--fg-secondary)",
};
const formActionsStyle: React.CSSProperties = { display: "flex", gap: 5, marginTop: 2 };
const createBtnStyle: React.CSSProperties = {
	flex: 1,
	padding: "3px 8px",
	border: "none",
	borderRadius: "var(--r-xs)",
	background: ACCENT,
	color: "#fff",
	cursor: "pointer",
	font: "inherit",
	fontSize: 10,
	fontWeight: 600,
};
const cancelBtnStyle: React.CSSProperties = {
	padding: "3px 8px",
	border: "1px solid var(--border-default)",
	borderRadius: "var(--r-xs)",
	background: "transparent",
	color: "var(--fg-secondary)",
	cursor: "pointer",
	font: "inherit",
	fontSize: 10,
};
