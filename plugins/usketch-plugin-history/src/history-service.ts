// Host-facing history API on the `ctx.services` seam (reference: usketch-plugin-map's
// map-service.ts). A host or another plugin can list, preview and restore versions
// without the HUD: `getHistoryApi(app.services)?.restore(hash)`.
import { defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { HistoryClient } from "./history-client.js";
import type { HistoryController } from "./history-controller.js";

export interface HistoryApi {
	/** Raw API client (list / commit / diff / create). */
	client: HistoryClient;
	/** Live panel state (commits, selection, diff, preview). */
	controller: HistoryController;
}

export const historyService = defineService<HistoryApi>("usketch-plugin-history");

export function getHistoryApi(services: ServiceRegistry): HistoryApi | undefined {
	return historyService.get(services);
}
