import type { ActionParam } from "@edv4h/usketch-shared";
import { INLINE_INPUT } from "../styles.js";

/**
 * Controlled input for a single {@link ActionParam}, shared by action params
 * (fire-and-run) and live settings fields (two-way). Pure: the caller owns the
 * value and applies `onChange`.
 */
export function ParamInputWidget({
	param,
	value,
	onChange,
}: {
	param: ActionParam;
	value: unknown;
	onChange: (v: unknown) => void;
}) {
	switch (param.type) {
		case "enum":
			return (
				<select
					value={String(value ?? "")}
					onChange={(e) => onChange(e.target.value)}
					style={{ ...INLINE_INPUT, width: "auto" }}
				>
					{param.options?.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			);
		case "boolean":
			return (
				<input
					type="checkbox"
					checked={Boolean(value)}
					onChange={(e) => onChange(e.target.checked)}
				/>
			);
		case "color":
			return (
				<input
					type="color"
					value={String(value ?? "#000000")}
					onChange={(e) => onChange(e.target.value)}
				/>
			);
		case "number":
			return (
				<input
					type="number"
					value={Number(value ?? 0)}
					min={param.min}
					max={param.max}
					step={param.step}
					onChange={(e) => onChange(Number(e.target.value))}
					style={INLINE_INPUT}
				/>
			);
		default:
			return (
				<input
					type="text"
					value={String(value ?? "")}
					onChange={(e) => onChange(e.target.value)}
					style={INLINE_INPUT}
				/>
			);
	}
}

/** Seed default arg values from a param list (for action params before Run). */
export function defaultArgs(params?: ActionParam[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const p of params ?? []) {
		if (p.default !== undefined) out[p.name] = p.default;
		else if (p.type === "enum") out[p.name] = p.options?.[0]?.value;
		else if (p.type === "boolean") out[p.name] = false;
		else if (p.type === "number") out[p.name] = p.min ?? 0;
		else if (p.type === "color") out[p.name] = "#000000";
		else out[p.name] = "";
	}
	return out;
}
