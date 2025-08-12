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
			"@whiteboard/canvas-core": path.resolve(__dirname, "../../packages/canvas-core/src"),
			"@whiteboard/drawing-tools": path.resolve(__dirname, "../../packages/drawing-tools/src"),
			"@whiteboard/shared-types": path.resolve(__dirname, "../../packages/shared-types/src"),
			"@whiteboard/shared-utils": path.resolve(__dirname, "../../packages/shared-utils/src"),
			"@whiteboard/store": path.resolve(__dirname, "../../packages/store/src"),
			"@whiteboard/ui-components": path.resolve(__dirname, "../../packages/ui-components/src"),
		},
	},
});
