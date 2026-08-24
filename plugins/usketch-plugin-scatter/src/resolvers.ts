// Relation resolvers: turn a seed shape id into the set of "related" shapes to
// scatter. Pluggable so "related" isn't hardcoded — built-ins cover connector
// neighbours and parent/children; hosts can register their own. Resolvers read the
// store generically (no connector/group plugin import) so this package stays leaf.
import type { RelationResolver, ScatterDeps, ScatterItem } from "./types.js";

/** Loose view of the two relation-bearing fields we scan for. */
type Related = { sourceId?: unknown; targetId?: unknown; parentId?: unknown };

/**
 * Connector neighbours: every shape joined to the seed by a connector (a shape
 * carrying `sourceId`/`targetId`) — the connector's OPPOSITE endpoint. Plugin-
 * agnostic: it just matches the `ConnectableShapeData` field shape.
 */
export const connectorNeighbors: RelationResolver = ({ store }, seedId) => {
	const out = new Set<string>();
	for (const [, shape] of store.getShapes()) {
		const r = shape as unknown as Related;
		const src = typeof r.sourceId === "string" ? r.sourceId : undefined;
		const tgt = typeof r.targetId === "string" ? r.targetId : undefined;
		if (src === seedId && tgt && tgt !== seedId) out.add(tgt);
		else if (tgt === seedId && src && src !== seedId) out.add(src);
	}
	return [...out].map((id) => ({ kind: "existing", id }) satisfies ScatterItem);
};

/** Parent/children: shapes whose `parentId` is the seed (group/frame/container/island members). */
export const parentChildren: RelationResolver = ({ store }, seedId) => {
	const out: ScatterItem[] = [];
	for (const [id, shape] of store.getShapes()) {
		if ((shape as unknown as Related).parentId === seedId) out.push({ kind: "existing", id });
	}
	return out;
};

const RESOLVERS = new Map<string, RelationResolver>([
	["connectors", connectorNeighbors],
	["children", parentChildren],
]);

export function registerRelationResolver(name: string, resolver: RelationResolver): () => void {
	RESOLVERS.set(name, resolver);
	return () => {
		if (RESOLVERS.get(name) === resolver) RESOLVERS.delete(name);
	};
}

export function getRelationResolver(name: string): RelationResolver | undefined {
	return RESOLVERS.get(name);
}

export function listRelationResolvers(): string[] {
	return [...RESOLVERS.keys()];
}

/** Resolve the item set: explicit `items` win; else run the named/function resolver. */
export function resolveItems(
	deps: Pick<ScatterDeps, "store">,
	seedId: string,
	relation: string | RelationResolver | undefined,
	items: ScatterItem[] | undefined,
): ScatterItem[] {
	if (items) return items;
	if (!relation) return [];
	const resolver = typeof relation === "function" ? relation : getRelationResolver(relation);
	if (!resolver) throw new Error(`[scatter] unknown relation resolver: ${String(relation)}`);
	return resolver(deps, seedId);
}
