import { ConnectorPropertyBar } from "@edv4h/usketch-plugin-shape-connector";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";

/**
 * App-owned layer for the connector parameter Toolbar.
 *
 * `@edv4h/usketch-plugin-shape-connector` intentionally no longer registers this
 * UI (the shape definition shouldn't dictate a settings Toolbar — see #665); it
 * only exports the `ConnectorPropertyBar` component. This app opts into the
 * default bar by registering it as its own layer, keeping the previous UX. A
 * host with a custom connector UI would simply omit this plugin.
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
