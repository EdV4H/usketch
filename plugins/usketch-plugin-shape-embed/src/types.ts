import type { ShapeData } from "@edv4h/usketch-shared";

/** Synced playback state (watch-party). Times in seconds; `at` is server-epoch ms. */
export interface PlaybackState {
	playing: boolean;
	/** Playhead position (s) as of `at`. */
	time: number;
	/** Server-clock epoch (ms) when this state was set. */
	at: number;
	updatedBy: string;
}

export type EmbedSyncMode = "free" | "presenter";

export interface EmbedShapeData extends ShapeData {
	type: "embed";
	/** Original (shareable) URL entered by the user. */
	url: string;
	/** Resolved provider id (e.g. "youtube"), for debug/serialize. */
	provider?: string;
	/** Interact mode: iframe receives pointer events (vs selectable/movable). */
	isActive?: boolean;
	/** Synced playback (syncable providers only). */
	playback?: PlaybackState;
	/** "free" = anyone controls (LWW); "presenter" = only presenterId controls. */
	syncMode?: EmbedSyncMode;
	presenterId?: string;
}
