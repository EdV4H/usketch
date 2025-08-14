import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 3001,
	},
	resolve: {
		alias: {
			"@usketch/canvas-core": path.resolve(__dirname, "../../packages/canvas-core/src"),
			"@usketch/drawing-tools": path.resolve(__dirname, "../../packages/drawing-tools/src"),
			"@usketch/shared-types": path.resolve(__dirname, "../../packages/shared-types/src"),
			"@usketch/shared-utils": path.resolve(__dirname, "../../packages/shared-utils/src"),
			"@usketch/store": path.resolve(__dirname, "../../packages/store/src"),
			"@usketch/ui-components": path.resolve(__dirname, "../../packages/ui-components/src"),
		},
	},
});
