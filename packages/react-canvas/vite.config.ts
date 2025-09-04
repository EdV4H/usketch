import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "ReactCanvas",
			fileName: "index",
			formats: ["es"],
		},
		rollupOptions: {
			external: ["react", "react-dom", "zustand", "@usketch/store", "@usketch/shared-types"],
			output: {
				globals: {
					react: "React",
					"react-dom": "ReactDOM",
				},
			},
		},
	},
});
