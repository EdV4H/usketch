export {
	CONNECTOR_LAYER_IDS,
	type ConnectorPluginOptions,
	createConnectorPlugin,
} from "./plugin.js";
// Connector data-model types — the shape's public contract. The parameter
// Toolbar UI is intentionally not part of this package (see #665); a host that
// builds its own connector settings UI imports these to read/write the shape.
export type { ArrowHead, PathType } from "./shapes/connector.js";
export type { ConnectorShapeData } from "./types.js";
