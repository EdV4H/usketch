import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { ConnectorPropertyBar } from "./connector-property-bar.js";

/**
 * App-owned layer for the connector parameter Toolbar.
 *
 * `@edv4h/usketch-plugin-shape-connector` intentionally does not ship this UI
 * (the shape definition shouldn't dictate a settings Toolbar — see #665). The
 * `ConnectorPropertyBar` component lives here in the app, built from the
 * connector data types the package exports. This app opts into the default bar
 * by registering it as its own layer, keeping the previous UX. A host with a
 * custom connector UI would simply omit this plugin.
 */
export function createConnectorPropertyBarPlugin(): UsketchPlugin {
	return {
		id: "app-connector-property-bar",
		name: "コネクタ プロパティバー",
		setup(ctx: PluginContext) {
			ctx.layers.register({
				id: "connector-properties",
				order: 82,
				fixed: true,
				render: () => <ConnectorPropertyBar />,
			});
			return () => {
				ctx.layers.unregister("connector-properties");
			};
		},
	};
}
