// The HUD's "キー設定" panel: one row per action with its keys as buttons. Click a key
// (or "+") and press the new key: Esc cancels, Delete / Backspace removes the key. A key
// taken from another action moves here. All rules are the pure functions of
// `character-keys.ts`; this only draws them and calls the service.
import { type CSSProperties, useEffect, useState, useSyncExternalStore } from "react";
import {
	actionOfKey,
	bindKey,
	canBindKey,
	KEY_ACTION_LABELS,
	KEY_ACTIONS,
	type KeyAction,
	keyLabel,
	MAX_KEYS_PER_ACTION,
	unbindKey,
	unboundDirections,
} from "./character-keys.js";
import type { CharacterApi } from "./character-service.js";

interface Picking {
	action: KeyAction;
	slot: number;
}

const MUTED = "var(--fg-tertiary, #888)";

const keyButton = (active: boolean): CSSProperties => ({
	minWidth: 44,
	padding: "2px 6px",
	fontSize: 12,
	fontFamily: "inherit",
	borderRadius: 4,
	border: `1px solid ${active ? "var(--accent, #4a8cff)" : "var(--border, #8884)"}`,
	background: active ? "var(--accent-bg, #4a8cff22)" : "transparent",
	color: "inherit",
	cursor: "pointer",
});

export function CharacterKeySettings({ api }: { api: CharacterApi }) {
	const keys = useSyncExternalStore(api.onKeysChange, api.getKeys, api.getKeys);
	const [picking, setPicking] = useState<Picking | null>(null);
	const [note, setNote] = useState<string | null>(null);

	useEffect(() => {
		if (!picking) return;
		const { action, slot } = picking;
		return api.captureNextKey((code) => {
			setPicking(null);
			if (code === "Escape") {
				setNote(null);
				return;
			}
			const current = api.getKeys();
			if (code === "Delete" || code === "Backspace") {
				api.setKeys(unbindKey(current, action, slot), { save: true });
				setNote(null);
				return;
			}
			if (!canBindKey(code, action)) {
				setNote(`${keyLabel(code)} は${KEY_ACTION_LABELS[action]}に割り当てられません`);
				return;
			}
			const from = actionOfKey(current, code);
			api.setKeys(bindKey(current, action, slot, code), { save: true });
			setNote(
				from && from !== action
					? `${keyLabel(code)} を${KEY_ACTION_LABELS[from]}から${KEY_ACTION_LABELS[action]}に移しました`
					: null,
			);
		});
	}, [api, picking]);

	const empty = unboundDirections(keys);
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
			{KEY_ACTIONS.map((action) => {
				const list = keys[action] ?? [];
				const slots = list.length < MAX_KEYS_PER_ACTION ? [...list, null] : list;
				return (
					<div
						key={action}
						data-key-action={action}
						style={{ display: "flex", alignItems: "center", gap: 4 }}
					>
						<span style={{ flex: "0 0 6.5em" }}>{KEY_ACTION_LABELS[action]}</span>
						{slots.map((code, slot) => {
							const active = picking?.action === action && picking.slot === slot;
							return (
								<button
									// biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
									key={slot}
									type="button"
									style={keyButton(active)}
									title={
										code
											? "クリックして新しいキーを押す（Delete で外す）"
											: "クリックしてキーを押す"
									}
									onClick={() => {
										setNote(null);
										setPicking(active ? null : { action, slot });
									}}
								>
									{active ? "キーを押す…" : code ? keyLabel(code) : "+"}
								</button>
							);
						})}
					</div>
				);
			})}
			<div style={{ color: MUTED, fontSize: 11 }}>
				{picking
					? "Esc でキャンセル、Delete / Backspace でこのキーを外します"
					: "キーをクリックして変更（この端末に保存）"}
			</div>
			{note && <div style={{ fontSize: 11 }}>{note}</div>}
			{empty.length > 0 && (
				<div style={{ fontSize: 11, color: "var(--danger, #d55)" }}>
					{empty.map((a) => KEY_ACTION_LABELS[a]).join("・")}のキーがありません
				</div>
			)}
			<div>
				<button
					type="button"
					style={keyButton(false)}
					onClick={() => {
						setPicking(null);
						setNote(null);
						api.resetKeys();
					}}
				>
					既定に戻す
				</button>
			</div>
		</div>
	);
}
