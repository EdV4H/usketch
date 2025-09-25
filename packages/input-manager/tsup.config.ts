import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: false, // 一旦無効化して後で型定義を別途生成
	clean: true,
	external: ["react"],
	sourcemap: false,
});
