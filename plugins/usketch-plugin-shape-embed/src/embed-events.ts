/**
 * Window CustomEvent bridge between the embed shape's in-render controls and the
 * plugin's setup listener. Kept out of the view module so that module can export
 * only React components (required for Vite/React Fast Refresh to work — mixing a
 * component export with a value export disables it and causes stale-closure
 * crashes on HMR).
 */
export const EMBED_ACTION_EVENT = "usketch:embed-action";

export type EmbedAction =
	| { id: string; action: "set-url"; url: string }
	| { id: string; action: "activate" | "deactivate" | "toggle-presenter" };

export const emitEmbedAction = (detail: EmbedAction): void => {
	window.dispatchEvent(new CustomEvent(EMBED_ACTION_EVENT, { detail }));
};
