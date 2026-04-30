import type { ArrowHead, ConnectableShapeData } from "@edv4h/usketch-connector-anchor";

/**
 * Connector shape extension: intrinsic data for the `connector` shape.
 *
 * Re-exported alias of `ConnectableShapeData` from `@edv4h/usketch-connector-anchor`.
 * The shared base type is defined there so other connector implementations
 * (e.g. the DDD domain-design plugin) can share anchor / tracking logic.
 */
export type ConnectorShapeData = ConnectableShapeData;

export type { ArrowHead };
