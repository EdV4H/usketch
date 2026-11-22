import type {
	HudRegistry,
	HudStatus,
	HudStatusValue,
	PermissionProvider,
} from "@edv4h/usketch-shared";
import type React from "react";
import { useCallback, useEffect, useReducer, useRef, useSyncExternalStore } from "react";
import { visibleStatuses } from "../hud-slots.js";
import { STOP_CANVAS_PROPAGATION } from "../stop-propagation.js";
import { FONT_FAMILY, MINI_BUTTON } from "../styles.js";

/**
 * The HUD's status bar: one pill per {@link HudStatus} that has something to say, centred at
 * the top of the free space between the HUD's panels (`left` / `right` are that space's insets).
 * Always on screen, also while the rest of the HUD is closed.
 */
export function StatusBar({
	hud,
	permissions,
	left,
	right,
}: {
	hud: HudRegistry;
	permissions?: PermissionProvider;
	left: number;
	right: number;
}) {
	const [, bump] = useReducer((n: number) => n + 1, 0);
	useEffect(() => hud.subscribe(bump), [hud]);
	useEffect(() => permissions?.subscribe(bump), [permissions]);

	const statuses = visibleStatuses(hud, permissions);
	if (statuses.length === 0) return null;
	return (
		<div style={{ ...barStyle, left, right }} data-testid="hud-status-bar">
			{statuses.map((status) => (
				<StatusPill key={status.id} status={status} />
			))}
		</div>
	);
}

function StatusPill({ status }: { status: HudStatus }) {
	const subscribe = useCallback((cb: () => void) => status.subscribe(cb), [status]);
	// `get` may build a new object every call; keep the previous one while it says the same,
	// so useSyncExternalStore sees a stable snapshot.
	const last = useRef<HudStatusValue | null>(null);
	const getSnapshot = useCallback(() => {
		const next = status.get();
		if (!sameStatus(last.current, next)) last.current = next;
		return last.current;
	}, [status]);
	const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	if (!value) return null;
	return (
		<div {...STOP_CANVAS_PROPAGATION} style={pillStyle(value.tone)} data-status-id={status.id}>
			<span>{value.text}</span>
			{value.action && (
				<button type="button" onClick={() => value.action?.run()} style={actionStyle}>
					{value.action.label}
				</button>
			)}
		</div>
	);
}

/** Whether two status values show the same thing. */
export function sameStatus(a: HudStatusValue | null, b: HudStatusValue | null): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return (
		a.text === b.text &&
		(a.tone ?? "info") === (b.tone ?? "info") &&
		// The button's `run` is often a fresh closure; the label says what it does.
		a.action?.label === b.action?.label
	);
}

const TONE_BG: Record<NonNullable<HudStatusValue["tone"]>, string> = {
	info: "rgba(0, 0, 0, 0.82)",
	success: "rgba(22, 101, 52, 0.9)",
	warning: "rgba(146, 64, 14, 0.92)",
	danger: "rgba(153, 27, 27, 0.92)",
};

const barStyle: React.CSSProperties = {
	position: "absolute",
	top: 8,
	zIndex: 2,
	display: "flex",
	flexWrap: "wrap",
	justifyContent: "center",
	gap: 6,
	alignItems: "center",
	pointerEvents: "none",
};

function pillStyle(tone: HudStatusValue["tone"]): React.CSSProperties {
	return {
		display: "inline-flex",
		alignItems: "center",
		gap: 8,
		padding: "4px 10px",
		borderRadius: 999,
		background: TONE_BG[tone ?? "info"],
		color: "#f4f4f5",
		fontFamily: FONT_FAMILY,
		fontSize: 11,
		whiteSpace: "nowrap",
		pointerEvents: "auto",
		boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
	};
}

const actionStyle: React.CSSProperties = {
	...MINI_BUTTON,
	background: "rgba(255, 255, 255, 0.16)",
};
