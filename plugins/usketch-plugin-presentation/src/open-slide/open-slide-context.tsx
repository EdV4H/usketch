import { type Context, type ReactNode, useMemo } from "react";

/*
 * open-slide のページは `useSlidePageNumber` / `useIsActivePage` / `<Steps>` で
 * ランタイムの Provider を読む。`@open-slide/core` は Provider を export していないが、
 * Context を globalThis の固定キーに置いている（dev / dist の二重読み込み対策）。
 * ここではそのキーから Context を拾って値を流す。デッキが `@open-slide/core` を
 * import した時点でキーが生えるので、ページ描画時には存在する。
 * キーが無い（open-slide の内部変更など）ときは Provider なしで描き、
 * `useSlidePageNumber` を使うページだけが ErrorBoundary に落ちる。
 */
const PAGE_CONTEXT_KEY = "__open_slide_page_context__";
const STEP_HOST_CONTEXT_KEY = "__open_slide_step_host_context__";

interface PageContextValue {
	index: number;
	total: number;
}

/** open-slide の StepHost が流す値のうち、ページ側が読むもの。 */
interface StepHostContextValue {
	register: (reg: unknown) => () => void;
	reportRevealed: (id: object, revealed: number) => void;
	entryDirection: "forward" | "backward" | "jump";
	controlled: boolean;
	isActivePage: boolean;
}

function readGlobalContext<T>(key: string): Context<T | null> | undefined {
	return (globalThis as Record<string, unknown>)[key] as Context<T | null> | undefined;
}

const noopUnregister = () => {};

export interface OpenSlidePageProviderProps {
	index: number;
	total: number;
	/**
	 * 発表中に画角に入っているページか。true のときだけページ側のアニメーション
	 * (`useIsActivePage`) が動く。false ならアニメーションの最終状態で静止して描く。
	 */
	active: boolean;
	children: ReactNode;
}

/**
 * open-slide のページ用 Provider 群。`<Steps>` は段階表示せず常に全表示にする
 * （ボード上のスライド内送りはページ単位）。
 */
export function OpenSlidePageProvider({
	index,
	total,
	active,
	children,
}: OpenSlidePageProviderProps) {
	const PageContext = readGlobalContext<PageContextValue>(PAGE_CONTEXT_KEY);
	const StepHostContext = readGlobalContext<StepHostContextValue>(STEP_HOST_CONTEXT_KEY);
	const pageValue = useMemo(() => ({ index, total }), [index, total]);
	const stepValue = useMemo<StepHostContextValue>(
		() => ({
			register: () => noopUnregister,
			reportRevealed: () => {},
			// "jump" で入ると <Steps> は全ステップを表示した状態で始まる。
			entryDirection: "jump",
			controlled: false,
			isActivePage: active,
		}),
		[active],
	);

	let node = children;
	if (StepHostContext) {
		node = <StepHostContext.Provider value={stepValue}>{node}</StepHostContext.Provider>;
	}
	if (PageContext) {
		node = <PageContext.Provider value={pageValue}>{node}</PageContext.Provider>;
	}
	return <>{node}</>;
}
