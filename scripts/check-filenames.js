#!/usr/bin/env node

const _fs = require("node:fs");
const path = require("node:path");
const glob = require("glob");

// kebab-case パターン（数字も許可、単一文字も許可）
// 例: 'a.ts', '1.ts', 'api-v2.ts', 'test-123.tsx'
const kebabCasePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// 例外ファイルのパターン
const exceptions = [
	/^next\.config\.ts$/,
	/^vite\.config\.ts$/,
	/^jest\.config\.ts$/,
	/^postcss\.config\.ts$/,
	/\.d\.ts$/,
];

function checkFilenames(specificFiles = []) {
	const errors = [];

	// ファイルリストを取得
	// 引数が指定されている場合はそれを使用、なければ全体をスキャン
	const files =
		specificFiles.length > 0
			? specificFiles.filter((f) => /\.(ts|tsx)$/.test(f))
			: glob.sync("**/*.{ts,tsx}", {
					ignore: ["node_modules/**", "dist/**", "build/**", ".next/**"],
				});

	files.forEach((filePath) => {
		const filename = path.basename(filePath, path.extname(filePath));
		const basename = path.basename(filePath);

		// ドット付きファイル名（*.test.ts, *.config.ts など）は除外
		if (filename.includes(".")) {
			return;
		}

		// 例外チェック
		const isException = exceptions.some((pattern) => pattern.test(basename));

		if (!isException && !kebabCasePattern.test(filename)) {
			errors.push(filePath);
		}
	});

	if (errors.length > 0) {
		console.error("❌ 以下のファイルがkebab-case命名規則に違反しています:");
		errors.forEach((file) => {
			const _filename = path.basename(file);
			const ext = path.extname(file);
			const nameWithoutExt = path.basename(file, ext);
			// toKebabCase関数と同じロジックを使用
			const parts = nameWithoutExt
				.replace(/_/g, "-")
				.match(/([A-Z]+(?=[A-Z][a-z0-9])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+)/g);
			const suggested = parts
				? parts.map((s) => s.toLowerCase()).join("-") + ext
				: nameWithoutExt.toLowerCase() + ext;
			console.error(`  ${file}`);
			console.error(`    → 推奨: ${suggested}`);
		});
		process.exit(1);
	}

	const message =
		specificFiles.length > 0
			? `✅ 指定されたTypeScript/TSXファイルがkebab-case命名規則に準拠しています`
			: `✅ すべてのTypeScript/TSXファイルがkebab-case命名規則に準拠しています`;
	console.log(message);
}

// コマンドライン引数を取得（node scripts/check-filenames.js file1.ts file2.tsx ...）
const args = process.argv.slice(2);
checkFilenames(args);
