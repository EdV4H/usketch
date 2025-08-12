import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	root: __dirname,
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@components": resolve(__dirname, "./src/components"),
			"@utils": resolve(__dirname, "./src/utils"),
			"@tools": resolve(__dirname, "./src/tools"),
			"@usketch/shared-types": resolve(__dirname, "../../packages/shared-types/src"),
			"@usketch/shared-utils": resolve(__dirname, "../../packages/shared-utils/src"),
			"@usketch/store": resolve(__dirname, "../../packages/store/src"),
			"@usketch/canvas-core": resolve(__dirname, "../../packages/canvas-core/src"),
			"@usketch/drawing-tools": resolve(__dirname, "../../packages/drawing-tools/src"),
			"@usketch/ui-components": resolve(__dirname, "../../packages/ui-components/src"),
		},
	},
	build: {
		outDir: "dist",
		sourcemap: true,
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
			},
		},
	},
	server: {
		port: 5173,
		open: true,
	},
	optimizeDeps: {
		include: ["zustand"],
	},
});
