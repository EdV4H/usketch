import { resolve } from "node:path";
import { defineConfig, type UserConfig } from "vite";

export interface BaseConfigOptions {
	root?: string;
	mode?: "development" | "production";
}

export function createBaseConfig(options: BaseConfigOptions = {}): UserConfig {
	const { root = process.cwd(), mode = "development" } = options;

	return {
		root,
		resolve: {
			alias: {
				"@": resolve(root, "./src"),
			},
		},
		server: {
			port: 5173,
			strictPort: false,
			host: true,
		},
		build: {
			target: "es2020",
			sourcemap: mode === "development",
			reportCompressedSize: false,
			chunkSizeWarningLimit: 500,
		},
		optimizeDeps: {
			include: [],
			exclude: [],
		},
	};
}

export function createAppConfig(options: BaseConfigOptions = {}) {
	const baseConfig = createBaseConfig(options);

	return defineConfig({
		...baseConfig,
		build: {
			...baseConfig.build,
			outDir: "dist",
			emptyOutDir: true,
			rollupOptions: {
				input: {
					main: resolve(options.root || process.cwd(), "index.html"),
				},
			},
		},
	});
}

export function createLibConfig(options: BaseConfigOptions & { entry?: string } = {}) {
	const baseConfig = createBaseConfig(options);
	const { entry = "src/index.ts" } = options;

	return defineConfig({
		...baseConfig,
		build: {
			...baseConfig.build,
			lib: {
				entry: resolve(options.root || process.cwd(), entry),
				formats: ["es"],
				fileName: "index",
			},
			rollupOptions: {
				external: ["react", "react-dom", "react/jsx-runtime", /^@whiteboard\//],
			},
		},
	});
}

export function createTestConfig(options: BaseConfigOptions = {}): any {
	const baseConfig = createBaseConfig(options);

	return {
		...baseConfig,
		test: {
			globals: true,
			environment: "jsdom",
			setupFiles: ["./src/test/setup.ts"],
			coverage: {
				reporter: ["text", "json", "html"],
				exclude: ["node_modules/", "src/test/"],
			},
		},
	};
}
