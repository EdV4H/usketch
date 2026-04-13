/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode, command }) => ({
	plugins: [react()],
	define: {
		"process.env.NODE_ENV": JSON.stringify(mode),
	},
	resolve: command === "serve" ? { conditions: ["source"] } : {},
	server: {
		port: 4578,
	},
	test: {
		exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
	},
}));
