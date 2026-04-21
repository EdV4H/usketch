import { useSyncExternalStore } from "react";
import {
	getCurrentTheme,
	type ResolvedTheme,
	resolveTheme,
	setTheme,
	subscribeTheme,
	type Theme,
} from "./theme.js";

function subscribe(callback: () => void): () => void {
	return subscribeTheme(callback);
}

export function useTheme(): {
	theme: Theme;
	resolved: ResolvedTheme;
	setTheme: (theme: Theme) => void;
} {
	const theme = useSyncExternalStore(subscribe, getCurrentTheme, getCurrentTheme);
	const resolved = resolveTheme(theme);
	return { theme, resolved, setTheme };
}
