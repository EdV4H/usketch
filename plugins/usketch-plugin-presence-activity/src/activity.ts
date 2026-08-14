import type { BoundingBox } from "@edv4h/usketch-shared";

/**
 * A participant's live "activity" — what they are currently selecting / editing —
 * published on the Yjs awareness `activity` field alongside the existing
 * `user`/`cursor` fields. It is a GENERAL multiplayer channel: every participant
 * (human or AI) publishes it, and the overlay renders it uniformly. There is no
 * AI discriminator — the AI is just another participant whose `user.name` is "AI".
 *
 * Writers (presence-cursor for humans, the MCP client for AI) set the awareness
 * field to an object of this shape; the overlay in this package reads it.
 */
export interface PresenceActivity {
	/** Shapes the participant currently has selected / is editing. */
	shapeIds?: string[];
	/** In-progress selection rectangle (world coords), while marquee-dragging. */
	marquee?: BoundingBox;
	/** What they're doing: `select` = passive highlight, `edit` = actively mutating (pulses). */
	action?: "select" | "edit";
	/** Optional label shown on the badge instead of the participant name. */
	label?: string;
}

/** The awareness `user` field this overlay reads (a subset of what presence-cursor writes). */
export interface PresenceUser {
	name?: string;
	color?: string;
}
