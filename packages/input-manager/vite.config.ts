import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: ["./src/__tests__/setup.ts"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
