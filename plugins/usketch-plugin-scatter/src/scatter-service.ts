// Host-facing scatter API, published on the `ctx.services` seam (defineService
// convention — see usketch-plugin-map/map-service.ts). Lets a host/other plugin
// run scatters + register custom patterns/resolvers without the Control HUD.
import { defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import { scatter } from "./engine.js";
import { listScatterPatterns, registerScatterPattern } from "./patterns.js";
import { listRelationResolvers, registerRelationResolver } from "./resolvers.js";
import type {
	RelationResolver,
	ScatterDeps,
	ScatterPattern,
	ScatterRequest,
	ScatterResult,
} from "./types.js";

export interface ScatterApi {
	scatter(request: ScatterRequest): Promise<ScatterResult>;
	registerPattern(name: string, pattern: ScatterPattern): () => void;
	registerResolver(name: string, resolver: RelationResolver): () => void;
	listPatterns(): string[];
	listResolvers(): string[];
}

export const scatterService = defineService<ScatterApi>("usketch-plugin-scatter");

export function createScatterApi(deps: ScatterDeps): ScatterApi {
	return {
		scatter: (request) => scatter(deps, request),
		registerPattern: registerScatterPattern,
		registerResolver: registerRelationResolver,
		listPatterns: listScatterPatterns,
		listResolvers: listRelationResolvers,
	};
}

/** Host accessor: `getScatterApi(app.services)?.scatter({...})`. Undefined when the
 *  scatter plugin isn't active. Works with `ctx.services` too. */
export function getScatterApi(services: ServiceRegistry): ScatterApi | undefined {
	return scatterService.get(services);
}
