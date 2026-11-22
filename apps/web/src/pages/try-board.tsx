import { useState } from "react";
import { Navigate, useLocation } from "react-router";
import { localBoards } from "../lib/local-boards.js";

/**
 * `/try`: ログインなしで手元で試すお試しボード。ブラウザごとに 1 つのローカルボード
 * （IndexedDB だけに保存）を開く。クエリ（`?desktop=1` など）はそのまま引き継ぐ。
 */
export function TryBoardPage() {
	const { search } = useLocation();
	// 描画のたびに作らないよう、最初の 1 回だけ用意する（ensureTry は冪等）。
	const [board] = useState(() => localBoards.ensureTry());
	return <Navigate to={`/local/${board.id}${search}`} replace />;
}
