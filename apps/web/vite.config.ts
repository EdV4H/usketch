/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
	plugins: [react()],
	define: {
		"process.env.NODE_ENV": JSON.stringify(mode),
	},
	// source条件はexportプラグインのreact-dom/serverと非互換のため無効化 (#551)
	// resolve: { conditions: ["source"] },
	server: {
		port: 4578,
	},
	test: {
		exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
	},
}));
