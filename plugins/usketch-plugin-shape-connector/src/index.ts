// The parameter Toolbar is not registered by the plugin — export the component
// so a host can render it as its own layer (see apps/web). Self-contained: reads
// selection/store via `useApp()`, takes no props.
export { ConnectorPropertyBar } from "./connector-property-bar.js";
export {
	CONNECTOR_LAYER_IDS,
	type ConnectorPluginOptions,
	createConnectorPlugin,
} from "./plugin.js";
