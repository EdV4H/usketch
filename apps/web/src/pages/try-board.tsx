import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { localBoards } from "../lib/local-boards.js";
import { importLocalBoards } from "../lib/try-board-import.js";

/**
 * `/try`: ログインなしで手元で試すお試しボード。ブラウザごとに 1 つのローカルボード
 * （IndexedDB だけに保存）を開く。クエリ（`?desktop=1` など）はそのまま引き継ぐ。
 *
 * 初めて開いたときは、前からあるローカルボードをお試しボードのページとして取り込む。
 */
// 取り込み中のもの（StrictMode などで effect が 2 回走っても 1 回だけ取り込む）
const importing = new Map<string, Promise<void>>();

function importOnce(tryBoardId: string, sources: { id: string; title: string }[]): Promise<void> {
	let running = importing.get(tryBoardId);
	if (!running) {
		running = importLocalBoards(tryBoardId, sources)
			.then((result) => localBoards.finishTryImports(result.boards))
			.catch((e: unknown) => {
				// 取り込めなくてもお試しボードは開く（次に開いたときにやり直す）
				console.error("[try] Could not import the local boards:", e);
			})
			.finally(() => importing.delete(tryBoardId));
		importing.set(tryBoardId, running);
	}
	return running;
}

export function TryBoardPage() {
	const { search } = useLocation();
	// 描画のたびに作らないよう、最初の 1 回だけ用意する（ensureTry は冪等）。
	const [board] = useState(() => localBoards.ensureTry());
	const [pending] = useState(() => localBoards.pendingTryImports(board.id));
	const [ready, setReady] = useState(pending.length === 0);

	useEffect(() => {
		if (pending.length === 0) return;
		let cancelled = false;
		void importOnce(board.id, pending).finally(() => {
			if (!cancelled) setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, [board.id, pending]);

	if (!ready) {
		return (
			<div role="status" style={{ padding: 24, fontFamily: "var(--font-sans)" }}>
				前に作ったボードを、お試しボードのページとして取り込んでいます…
			</div>
		);
	}
	return <Navigate to={`/local/${board.id}${search}`} replace />;
}
