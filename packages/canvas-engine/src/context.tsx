import type { AppInstance } from "@edv4h/usketch-core";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { AnchorStackContext, AnchorStackRegistry } from "./hooks/use-anchor-stack.js";

const AppContext = createContext<AppInstance | null>(null);

export function AppProvider({ app, children }: { app: AppInstance; children: ReactNode }) {
	const anchorStack = useMemo(() => new AnchorStackRegistry(), []);
	return (
		<AppContext value={app}>
			<AnchorStackContext value={anchorStack}>{children}</AnchorStackContext>
		</AppContext>
	);
}

export function useApp(): AppInstance {
	const app = useContext(AppContext);
	if (!app) {
		throw new Error("useApp must be used within an AppProvider");
	}
	return app;
}
