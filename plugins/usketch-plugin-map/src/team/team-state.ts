// Active team-tool interaction state, shared between the palette and the tool.
// Module-scoped, app-local (not synced). Team data itself lives in the synced
// `team-map` shape; this is only which team/mode the local user is editing with.
import { useSyncExternalStore } from "react";
import { createReactiveStore } from "../reactive-store.js";

export type TeamMode = "assign" | "erase" | "island";

export interface TeamToolState {
	/** Currently selected team id, or null when none is chosen yet. */
	activeTeamId: string | null;
	mode: TeamMode;
}

export const teamStateStore = createReactiveStore<TeamToolState>({
	activeTeamId: null,
	mode: "assign",
});

export function useTeamState(): TeamToolState {
	return useSyncExternalStore(teamStateStore.subscribe, teamStateStore.get, teamStateStore.get);
}
