/**
 * エフェクトハンドラのエクスポート
 */

export {
	applyAutoLayout,
	applyInheritStyle,
	applyMaintainDistance,
} from "./advanced-effects";
export {
	applyClipByParent,
	applyMoveWithParent,
	applyResizeWithParent,
	applyRotateWithParent,
} from "./basic-effects";

import type { EffectHandler, EffectType } from "@usketch/shared-types";
import { applyAutoLayout, applyInheritStyle, applyMaintainDistance } from "./advanced-effects";
import {
	applyClipByParent,
	applyMoveWithParent,
	applyResizeWithParent,
	applyRotateWithParent,
} from "./basic-effects";

/**
 * エフェクトハンドラのレジストリ
 */
export const effectHandlers: Record<EffectType, EffectHandler> = {
	"move-with-parent": applyMoveWithParent,
	"resize-with-parent": applyResizeWithParent,
	"rotate-with-parent": applyRotateWithParent,
	"clip-by-parent": applyClipByParent,
	"inherit-style": applyInheritStyle,
	"auto-layout": applyAutoLayout,
	"maintain-distance": applyMaintainDistance,
};
