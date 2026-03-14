import type { AppInstance } from "@usketch/core";
import { createContext, type ReactNode, useContext } from "react";

const AppContext = createContext<AppInstance | null>(null);

export function AppProvider({ app, children }: { app: AppInstance; children: ReactNode }) {
	return <AppContext value={app}>{children}</AppContext>;
}

export function useApp(): AppInstance {
	const app = useContext(AppContext);
	if (!app) {
		throw new Error("useApp must be used within an AppProvider");
	}
	return app;
}
