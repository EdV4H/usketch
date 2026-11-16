import type React from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { SessionClient } from "./session-client.js";
import type { ClientSessionType } from "./session-type.js";

const ACCENT = "var(--u-1)";
const tint = (v: string, pct: number) => `color-mix(in srgb, ${v} ${pct}%, transparent)`;

/**
 * Generic session panel for the Control HUD. The **server is authoritative** and
 * this shell is **type-agnostic**: it owns the list + create affordances and the
 * host lifecycle wiring, then delegates each card's body and the create form to
 * the registered {@link ClientSessionType} for `session.type`. Session types
 * (voting, tutorial, cards…) live in their own packages and are passed in via
 * `types` — nothing here knows about voting.
 */
export function SessionPanel({
	client,
	userId,
	types,
}: {
	client: SessionClient;
	userId: string;
	types: readonly ClientSessionType[];
}) {
	const state = useSyncExternalStore(client.subscribe, client.getState, client.getState);
	const registry = useMemo(() => new Map(types.map((t) => [t.type, t])), [types]);
	// Types without a create form are started from the host's own UI (getSessionApi).
	const creatable = useMemo(() => types.filter((t) => t.renderCreateForm), [types]);
	const listed = state.sessions.filter((s) => registry.get(s.type)?.renderCard);
	const [creating, setCreating] = useState<string | null>(null);

	return (
		<div style={wrapStyle}>
			{state.error && <div style={errorStyle}>⚠ {state.error}</div>}

			{listed.length === 0 ? (
				<div style={emptyStyle}>進行中のセッションはありません</div>
			) : (
				<div style={listStyle}>
					{listed.map((s) => {
						const t = registry.get(s.type);
						if (!t?.renderCard) return null;
						return (
							<div key={s.id}>
								{t.renderCard({
									session: s,
									isHost: s.hostUserId === userId,
									me: userId,
									myPrivate: state.privates[s.id],
									act: (action) => client.act(s.id, action),
									close: () => client.close(s.id),
									end: () => client.end(s.id),
									leave: () => client.leave(s.id),
								})}
							</div>
						);
					})}
				</div>
			)}

			{creating && registry.get(creating)?.renderCreateForm ? (
				registry.get(creating)?.renderCreateForm?.({
					create: (config) => client.create(config),
					dismiss: () => setCreating(null),
				})
			) : creatable.length === 0 ? null : creatable.length === 1 ? (
				<button type="button" style={newBtnStyle} onClick={() => setCreating(creatable[0].type)}>
					＋ {creatable[0].label}を作成
				</button>
			) : (
				<div style={pickerStyle}>
					{creatable.map((t) => (
						<button
							key={t.type}
							type="button"
							style={pickerBtnStyle}
							onClick={() => setCreating(t.type)}
						>
							＋ {t.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

// ── styles (HUD compact scale; theme-aware tokens) ──

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
const pickerStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 5 };
const pickerBtnStyle: React.CSSProperties = { ...newBtnStyle, flex: "1 1 auto" };
