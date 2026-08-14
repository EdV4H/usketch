import type { BoundingBox, Viewport } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";

/**
 * A participant's resolved activity, in world coordinates — the input to a custom
 * {@link PresenceActivityStyle.renderParticipant}. `clientId` is the awareness
 * client id, or `-1` for the local in-app AI participant.
 */
export interface PresenceParticipant {
	clientId: number;
	name: string;
	color: string;
	action: "select" | "edit";
	/** World-space bounds of each selected/edited shape. */
	boxes: BoundingBox[];
	/** In-progress marquee rect (world coords), if any. */
	marquee?: BoundingBox;
}

/**
 * Host-facing appearance options for the presence-activity overlay (#960). Everything
 * is optional and merges over the defaults, so passing `{}` keeps the stock look.
 * Applies to ALL participants (the AI is just a participant) — for total control use
 * {@link renderParticipant}.
 */
export interface PresenceActivityStyle {
	/** Outline drawn around each selected / edited shape. */
	outline?: {
		strokeWidth?: number;
		/** Screen-px inflation so the outline sits just outside the shape. */
		padding?: number;
		/** Corner radius (rx). */
		radius?: number;
		opacity?: number;
		/** Pulse the outline while `action === "edit"`. */
		pulse?: boolean;
	};
	/** In-progress marquee rectangle. */
	marquee?: {
		fillOpacity?: number;
		strokeWidth?: number;
		dash?: string;
	};
	/** Name badge above the participant's group. */
	badge?: {
		enabled?: boolean;
		/** Appended to the name while editing (default `" ✏️"`). */
		editingSuffix?: string;
		fontSize?: number;
		fontWeight?: number;
	};
	/** Identity of the LOCAL in-app AI participant (⌘K agent). */
	aiParticipant?: {
		label?: string;
		color?: string;
	};
	/**
	 * Full override: return your own SVG (rendered in screen space) for a
	 * participant's activity instead of the default outline/marquee/badge. Return
	 * `null` to draw nothing for that participant.
	 */
	renderParticipant?: (p: PresenceParticipant, viewport: Viewport) => ReactElement | null;
}

export interface ResolvedActivityStyle {
	outline: Required<NonNullable<PresenceActivityStyle["outline"]>>;
	marquee: Required<NonNullable<PresenceActivityStyle["marquee"]>>;
	badge: Required<NonNullable<PresenceActivityStyle["badge"]>>;
	aiParticipant: Required<NonNullable<PresenceActivityStyle["aiParticipant"]>>;
	renderParticipant?: PresenceActivityStyle["renderParticipant"];
}

/** The stock appearance — matches the look shipped in #960 PR1–PR3. */
export const DEFAULT_ACTIVITY_STYLE: ResolvedActivityStyle = {
	outline: { strokeWidth: 2, padding: 3, radius: 4, opacity: 0.9, pulse: true },
	marquee: { fillOpacity: 0.08, strokeWidth: 1.5, dash: "6 4" },
	badge: { enabled: true, editingSuffix: " ✏️", fontSize: 11, fontWeight: 600 },
	aiParticipant: { label: "AI 🤖", color: "#7c3aed" },
};

/**
 * Copy `override` over `base`, keeping the base value wherever the override is
 * `undefined` (plain spread would let an explicit `undefined` clobber a default and
 * later turn arithmetic like `x - padding` into `NaN`).
 */
function mergeDefined<T extends object>(base: T, override?: Partial<T>): T {
	const out = { ...base };
	if (override) {
		for (const key of Object.keys(override) as (keyof T)[]) {
			const value = override[key];
			if (value !== undefined) out[key] = value as T[keyof T];
		}
	}
	return out;
}

/** Shallow-merge a host style over the defaults (per group; ignores explicit undefined). */
export function resolveActivityStyle(style?: PresenceActivityStyle): ResolvedActivityStyle {
	return {
		outline: mergeDefined(DEFAULT_ACTIVITY_STYLE.outline, style?.outline),
		marquee: mergeDefined(DEFAULT_ACTIVITY_STYLE.marquee, style?.marquee),
		badge: mergeDefined(DEFAULT_ACTIVITY_STYLE.badge, style?.badge),
		aiParticipant: mergeDefined(DEFAULT_ACTIVITY_STYLE.aiParticipant, style?.aiParticipant),
		renderParticipant: style?.renderParticipant,
	};
}
