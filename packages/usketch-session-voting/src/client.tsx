import type {
	ClientSessionType,
	SessionCardContext,
	SessionCreateContext,
} from "@edv4h/usketch-plugin-session";
import type React from "react";
import { useState } from "react";
import type { VotingPrivateState, VotingPublicState } from "./types.js";

export type { VotingPrivateState, VotingPublicState } from "./types.js";

// Align with the HUD's compact design tokens (theme-aware CSS variables).
const ACCENT = "var(--u-1)";
const tint = (v: string, pct: number) => `color-mix(in srgb, ${v} ${pct}%, transparent)`;

/**
 * The `voting` session type's **client** half: renders the live poll card and
 * the create form inside the framework's HUD panel. All logic is server-side
 * (see `../server`); this only draws public state + the caller's own private
 * receipt and sends intents via the framework-provided context.
 */
export const votingClientType: ClientSessionType = {
	type: "voting",
	label: "投票",
	renderCreateForm: (ctx) => <CreateVoteForm ctx={ctx} />,
	renderCard: (ctx) => <VotingCard ctx={ctx} />,
};

/** Short, readable form of a userId for the host indicator. */
function shortId(id: string): string {
	return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

function VotingCard({ ctx }: { ctx: SessionCardContext }) {
	const { session, isHost, me } = ctx;
	const pub = session.public as VotingPublicState;
	const myPrivate = ctx.myPrivate as VotingPrivateState | undefined;
	const myVotes = myPrivate?.myVotes ?? [];
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
							onClick={() => ctx.act({ kind: "cast", optionIndex: i })}
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
						onClick={ctx.end}
						title="全員のパネルから削除"
					>
						🗑 終了して削除
					</button>
				) : (
					<button
						type="button"
						style={hostCloseBtnStyle}
						onClick={ctx.close}
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

function CreateVoteForm({ ctx }: { ctx: SessionCreateContext }) {
	const [question, setQuestion] = useState("");
	const [options, setOptions] = useState(["", "", "", ""]);
	const [secret, setSecret] = useState(false);
	const [multi, setMulti] = useState(false);

	const validOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
	const canCreate = question.trim().length > 0 && validOptions.length >= 2;

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
						ctx.create({
							type: "voting",
							question: question.trim(),
							options: validOptions,
							secret,
							multi,
						});
						ctx.dismiss();
					}}
				>
					作成
				</button>
				<button type="button" style={cancelBtnStyle} onClick={ctx.dismiss}>
					キャンセル
				</button>
			</div>
		</div>
	);
}

// ── styles (HUD compact scale; theme-aware tokens) ──

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
