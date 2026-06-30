import type { AltBehavior } from "./engine/types.js";

/**
 * Alt(Option) キー押下を考慮した実効スナップ有効状態。
 * - 非押下: `enabled` のまま
 * - 押下 + `"suppress"`: 常に false（従来挙動）
 * - 押下 + `"invert"`: `!enabled`（無効→一時有効 / 有効→一時無効）
 */
export function effectiveSnapEnabled(
	enabled: boolean,
	altKeyHeld: boolean,
	altBehavior: AltBehavior,
): boolean {
	if (!altKeyHeld) return enabled;
	return altBehavior === "invert" ? !enabled : false;
}
