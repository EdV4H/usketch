/**
 * Customizable look of the voice-notes visuals. Every field is optional on the
 * public {@link VoiceNotesAppearance}; {@link resolveAppearance} fills defaults so
 * consumers always get a fully-populated {@link ResolvedAppearance}. New knobs are
 * added by extending these groups — callers only override what they care about.
 */

export interface PinLook {
	/** Pin bounding size in px (the tip anchors at the click). */
	size: number;
	recordingColor: string;
	/** transcribing / summarizing color. */
	busyColor: string;
	errorColor: string;
}
export interface FrameLook {
	fill: string;
	stroke: string;
	strokeWidth: number;
	headerBg: string;
	headerColor: string;
	defaultTitle: string;
}
export interface NodeLook {
	fill: string;
	stroke: string;
	strokeWidth: number;
	fontSize: number;
}
export interface ConnectorLook {
	stroke: string;
	strokeWidth: number;
}
export interface MarkdownLook {
	fill: string;
	stroke: string;
}

export interface ResolvedAppearance {
	pin: PinLook;
	frame: FrameLook;
	node: NodeLook;
	connector: ConnectorLook;
	markdown: MarkdownLook;
}

export interface VoiceNotesAppearance {
	pin?: Partial<PinLook>;
	frame?: Partial<FrameLook>;
	/** Summary diagram nodes (rounded-rect boxes). */
	node?: Partial<NodeLook>;
	/** Summary diagram connectors (arrows). */
	connector?: Partial<ConnectorLook>;
	/** The transcript-summary markdown shape (pin output). */
	markdown?: Partial<MarkdownLook>;
}

export const DEFAULT_APPEARANCE: ResolvedAppearance = {
	pin: { size: 40, recordingColor: "#ef4444", busyColor: "#2563eb", errorColor: "#f97316" },
	frame: {
		fill: "#fbfbfe",
		stroke: "#6366f1",
		strokeWidth: 2,
		headerBg: "#eef2ff",
		headerColor: "#3730a3",
		defaultTitle: "録音フレーム",
	},
	node: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, fontSize: 13 },
	connector: { stroke: "#1e1e1e", strokeWidth: 2 },
	markdown: { fill: "#ffffff", stroke: "#e0e0e0" },
};

/** Merge caller overrides over the defaults (one level deep, per group). */
export function resolveAppearance(a?: VoiceNotesAppearance): ResolvedAppearance {
	return {
		pin: { ...DEFAULT_APPEARANCE.pin, ...a?.pin },
		frame: { ...DEFAULT_APPEARANCE.frame, ...a?.frame },
		node: { ...DEFAULT_APPEARANCE.node, ...a?.node },
		connector: { ...DEFAULT_APPEARANCE.connector, ...a?.connector },
		markdown: { ...DEFAULT_APPEARANCE.markdown, ...a?.markdown },
	};
}
