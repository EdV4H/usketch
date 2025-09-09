#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const glob = require("glob");
const { execSync } = require("node:child_process");

// kebab-case パターン（数字も許可、単一文字も許可）
const kebabCasePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// 例外ファイルのパターン
const exceptions = [
	/^next\.config\.ts$/,
	/^vite\.config\.ts$/,
	/^jest\.config\.ts$/,
	/^postcss\.config\.ts$/,
	/\.d\.ts$/,
];

function toKebabCase(str) {
	// アクロニム（複数の大文字）、小文字、数字のグループにマッチ
	// 例: 'API2Service' -> ['API', '2', 'Service']
	// 'XMLHttpRequest' -> ['XML', 'Http', 'Request']
	const parts = str
		.replace(/_/g, "-") // アンダースコアをハイフンとして扱う
		.match(/([A-Z]+(?=[A-Z][a-z0-9])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+)/g);

	if (!parts) return str.toLowerCase();

	return parts
		.map((s) => s.toLowerCase())
		.join("-")
		.replace(/-+/g, "-") // 重複するハイフンを単一に
		.replace(/^-|-$/g, ""); // 先頭・末尾のハイフンを削除
}

function renameFiles() {
	const files = glob.sync("**/*.{ts,tsx}", {
		ignore: ["node_modules/**", "dist/**", "build/**", ".next/**"],
	});

	const renames = [];

	files.forEach((filePath) => {
		const dir = path.dirname(filePath);
		const ext = path.extname(filePath);
		const filename = path.basename(filePath, ext);
		const basename = path.basename(filePath);

		// 例外チェック
		const isException = exceptions.some((pattern) => pattern.test(basename));
		if (isException) return;

		// すでにkebab-caseの場合はスキップ
		if (kebabCasePattern.test(filename)) return;

		const newFilename = toKebabCase(filename);
		const newPath = path.join(dir, newFilename + ext);

		renames.push({ from: filePath, to: newPath });
	});

	if (renames.length === 0) {
		console.log("✅ すべてのファイルがkebab-case命名規則に準拠しています");
		return;
	}

	console.log(`📝 ${renames.length}個のファイルをリネームします：\n`);

	// Git mvコマンドを実行
	renames.forEach(({ from, to }) => {
		console.log(`  ${from} → ${to}`);
		try {
			execSync(`git mv "${from}" "${to}"`, { stdio: "pipe" });
		} catch (error) {
			console.error(`❌ リネーム失敗: ${from}`);
			console.error(error.message);
		}
	});

	console.log("\n✅ ファイルのリネームが完了しました");
	console.log("⚠️  インポート文の更新が必要です。次のステップで自動更新します。");
}

renameFiles();
