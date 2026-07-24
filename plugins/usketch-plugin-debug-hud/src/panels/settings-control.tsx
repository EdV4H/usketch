import type { ActionParam, HudSettingsDescriptor } from "@edv4h/usketch-shared";
import { useEffect, useReducer } from "react";
import { TEXT_LABEL } from "../styles.js";
import { ParamInputWidget } from "./param-input.js";

/**
 * Renders a plugin-contributed {@link HudSettingsDescriptor} as live, two-way
 * controls: each field reads its current value from `descriptor.get` and writes
 * via `descriptor.set` on change. Subscribes to `descriptor.subscribe` so the
 * controls reflect external state changes (a slider tracks the live value).
 */
export function SettingsGroup({ descriptor }: { descriptor: HudSettingsDescriptor }) {
	const [, bump] = useReducer((n: number) => n + 1, 0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-subscribe only when the descriptor identity changes
	useEffect(() => descriptor.subscribe(bump), [descriptor]);

	return (
		<div style={{ marginBottom: 4 }}>
			{descriptor.label && (
				<div style={{ color: TEXT_LABEL, fontSize: 10, marginBottom: 3 }}>{descriptor.label}</div>
			)}
			{descriptor.fields.map((field) => (
				<SettingsField key={field.name} descriptor={descriptor} field={field} />
			))}
		</div>
	);
}

function SettingsField({
	descriptor,
	field,
}: {
	descriptor: HudSettingsDescriptor;
	field: ActionParam;
}) {
	const value = descriptor.get(field.name);
	// A wrapping <label> implicitly associates with the input rendered inside
	// ParamInputWidget (real a11y + larger hit target). biome can't see through
	// the child component to the control, hence the ignore.
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: the control is rendered inside ParamInputWidget
		<label
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 6,
				marginBottom: 3,
				color: TEXT_LABEL,
				fontSize: 10,
			}}
		>
			<span>{field.label ?? field.name}</span>
			<ParamInputWidget
				param={field}
				value={value}
				onChange={(v) => descriptor.set(field.name, v)}
			/>
		</label>
	);
}
