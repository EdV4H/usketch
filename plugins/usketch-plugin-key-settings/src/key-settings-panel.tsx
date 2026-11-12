// The HUD's "キー設定" panel: every plugin's key bindings, grouped, with their keys as
// buttons. Click a key (or "+") and press the new one: Esc cancels, Delete / Backspace
// takes the key off. Keys another binding also uses are marked. The rules are the pure
// functions of `key-settings-model.ts`; this only draws them.
import { formatBindingKey } from "@edv4h/usketch-core";
import type { KeyBinding, Keymap } from "@edv4h/usketch-shared";
import { type CSSProperties, useEffect, useReducer, useState } from "react";
import { captureKeys } from "./key-capture.js";
import {
	applyPickedKey,
	bindingName,
	groupBindings,
	MAX_KEYS_PER_BINDING,
	type PickOptions,
	sharersOf,
} from "./key-settings-model.js";

interface Picking {
	id: string;
	slot: number;
}

export interface KeySettingsPanelProps {
	keymap: Keymap;
	/** Plugin id → display name. */
	pluginName: (pluginId: string | undefined) => string | undefined;
	pickOptions?: PickOptions;
}

const MUTED = "var(--fg-tertiary, #888)";
const KEY_FORMAT = { sides: { left: "左", right: "右" } };
const WARN = "var(--warning, #d90)";

const keyButton = (active: boolean, conflict: boolean, disabled: boolean): CSSProperties => ({
	minWidth: 32,
	padding: "2px 6px",
	fontSize: 12,
	fontFamily: "inherit",
	borderRadius: 4,
	border: `1px solid ${
		active ? "var(--accent, #4a8cff)" : conflict ? WARN : "var(--border, #8884)"
	}`,
	background: active ? "var(--accent-bg, #4a8cff22)" : "transparent",
	color: "inherit",
	cursor: disabled ? "default" : "pointer",
	opacity: disabled ? 0.6 : 1,
});

const owner = (b: KeyBinding, pluginName: KeySettingsPanelProps["pluginName"]): string =>
	pluginName(b.pluginId) ?? b.pluginId ?? "アプリ";

const describe = (list: readonly KeyBinding[], pluginName: KeySettingsPanelProps["pluginName"]) =>
	list.map((b) => `${bindingName(b)}（${owner(b, pluginName)}）`).join("、");

export function KeySettingsPanel({ keymap, pluginName, pickOptions }: KeySettingsPanelProps) {
	const [, rerender] = useReducer((n: number) => n + 1, 0);
	useEffect(() => keymap.subscribe(rerender), [keymap]);
	const [picking, setPicking] = useState<Picking | null>(null);
	const [note, setNote] = useState<string | null>(null);
	const [filter, setFilter] = useState("");
	const [onlyShared, setOnlyShared] = useState(false);

	useEffect(() => {
		if (!picking) return;
		const { id, slot } = picking;
		return captureKeys(keymap, (event) => {
			const result = applyPickedKey(keymap, id, slot, event, pickOptions);
			const binding = keymap.get(id);
			const name = binding ? bindingName(binding) : id;
			const label = (key: string) =>
				binding ? formatBindingKey(binding.kind, key, KEY_FORMAT) : key;
			switch (result.type) {
				case "wait":
					return false;
				case "cancel":
					setNote(null);
					break;
				case "removed":
					setNote(`${label(result.key)} を${name}から外しました`);
					break;
				case "refused":
					setNote(`${label(result.key)} は${name}に割り当てられません`);
					break;
				case "assigned": {
					const parts: string[] = [];
					if (result.movedFrom.length > 0) {
						parts.push(
							`${label(result.key)} を${result.movedFrom.map(bindingName).join("、")}から移しました`,
						);
					}
					if (result.sharedWith.length > 0) {
						parts.push(
							`${label(result.key)} は${describe(result.sharedWith, pluginName)}でも使われています`,
						);
					}
					setNote(parts.length > 0 ? parts.join("。") : null);
					break;
				}
			}
			setPicking(null);
			return true;
		});
	}, [keymap, picking, pickOptions, pluginName]);

	// Read fresh on every render (a keymap change re-renders through the reducer above).
	const all = keymap.getAll();
	const groups = groupBindings(all, pluginName, filter);
	const anyOverridden = all.some((b) => b.overridden);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
			<input
				type="search"
				placeholder="操作・キーで絞り込み"
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
				style={{ fontSize: 12, padding: "2px 4px" }}
			/>
			<label style={{ display: "flex", alignItems: "center", gap: 4 }}>
				<input
					type="checkbox"
					checked={onlyShared}
					onChange={(e) => setOnlyShared(e.target.checked)}
				/>
				ほかの操作と重なっているキーだけ
			</label>
			{groups.map((group) => {
				const rows = group.bindings.filter(
					(b) => !onlyShared || b.keys.some((k) => sharersOf(keymap, b, k).length > 0),
				);
				if (rows.length === 0) return null;
				return (
					<div key={group.title} data-key-group={group.title}>
						<div style={{ fontWeight: 600, margin: "4px 0 2px" }}>{group.title}</div>
						{rows.map((b) => (
							<BindingRow
								key={b.id}
								binding={b}
								keymap={keymap}
								picking={picking}
								pluginName={pluginName}
								onPick={(slot) => {
									setNote(null);
									const active = picking?.id === b.id && picking.slot === slot;
									setPicking(active ? null : { id: b.id, slot });
								}}
							/>
						))}
					</div>
				);
			})}
			<div style={{ color: MUTED, fontSize: 11 }}>
				{picking
					? "新しいキーを押してください。Esc でキャンセル、Delete / Backspace でこのキーを外します"
					: "キーをクリックして変更（この端末に保存）。⚠ はほかの操作と重なっているキーで、どれが動くかはアプリの振り分けルールで決まります"}
			</div>
			{note && <div style={{ fontSize: 11 }}>{note}</div>}
			{anyOverridden && (
				<div>
					<button
						type="button"
						style={keyButton(false, false, false)}
						onClick={() => {
							setPicking(null);
							setNote(null);
							keymap.resetKeys();
						}}
					>
						すべて既定に戻す
					</button>
				</div>
			)}
		</div>
	);
}

function BindingRow({
	binding,
	keymap,
	picking,
	pluginName,
	onPick,
}: {
	binding: KeyBinding;
	keymap: Keymap;
	picking: Picking | null;
	pluginName: KeySettingsPanelProps["pluginName"];
	onPick: (slot: number) => void;
}) {
	const keys = binding.keys;
	const editable = binding.customizable;
	const slots: (string | null)[] =
		editable && keys.length < MAX_KEYS_PER_BINDING ? [...keys, null] : [...keys];
	return (
		<div
			data-key-binding={binding.id}
			style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", minHeight: 22 }}
		>
			<span
				style={{ flex: "0 0 7.5em", color: binding.enabled ? "inherit" : MUTED }}
				title={`${owner(binding, pluginName)} / ${binding.id}`}
			>
				{bindingName(binding)}
			</span>
			{slots.length === 0 && <span style={{ color: MUTED }}>なし</span>}
			{slots.map((key, slot) => {
				const active = picking?.id === binding.id && picking.slot === slot;
				const sharers = key ? sharersOf(keymap, binding, key) : [];
				const conflict = sharers.length > 0;
				const title = !editable
					? "このキーは変更できません"
					: conflict
						? `${describe(sharers, pluginName)}でも使われています。クリックして変更（Delete で外す）`
						: key
							? "クリックして新しいキーを押す（Delete で外す）"
							: "クリックしてキーを押す";
				return (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
						key={slot}
						type="button"
						disabled={!editable}
						style={keyButton(active, conflict, !editable)}
						title={title}
						onClick={() => onPick(slot)}
					>
						{active
							? "キーを押す…"
							: key
								? `${conflict ? "⚠ " : ""}${formatBindingKey(binding.kind, key, KEY_FORMAT)}`
								: "+"}
					</button>
				);
			})}
			{binding.overridden && (
				<button
					type="button"
					style={{ ...keyButton(false, false, false), minWidth: 0 }}
					title="既定のキーに戻す"
					onClick={() => keymap.resetKeys(binding.id)}
				>
					↺
				</button>
			)}
		</div>
	);
}
