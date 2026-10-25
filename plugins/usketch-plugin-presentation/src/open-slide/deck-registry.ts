import type { OpenSlideDeck, OpenSlideModule } from "./types.js";

type LoadState =
	| { status: "loading"; promise: Promise<OpenSlideModule> }
	| { status: "loaded"; module: OpenSlideModule }
	| { status: "error"; error: unknown };

/**
 * ホストが登録した open-slide デッキの一覧と、読み込んだモジュールのキャッシュ。
 * 読み込み完了を購読でき、Shape の描画や発表のステップ数がそれに追従する。
 */
export class OpenSlideDeckRegistry {
	private readonly decks: Map<string, OpenSlideDeck>;
	private readonly states = new Map<string, LoadState>();
	private readonly listeners = new Set<() => void>();

	constructor(decks: readonly OpenSlideDeck[]) {
		this.decks = new Map(decks.map((d) => [d.id, d]));
	}

	getDecks(): OpenSlideDeck[] {
		return [...this.decks.values()];
	}

	getDeck(id: string): OpenSlideDeck | undefined {
		return this.decks.get(id);
	}

	/** 読み込み済みのモジュール。未読み込み・失敗・未登録なら undefined。 */
	getLoaded(id: string): OpenSlideModule | undefined {
		const state = this.states.get(id);
		return state?.status === "loaded" ? state.module : undefined;
	}

	/** 読み込みに失敗していればそのエラー。 */
	getError(id: string): unknown {
		const state = this.states.get(id);
		return state?.status === "error" ? state.error : undefined;
	}

	/** 読み込み済みならページ数、まだなら undefined。 */
	getPageCount(id: string): number | undefined {
		return this.getLoaded(id)?.default.length;
	}

	/**
	 * デッキを読み込む（同じ id は一度だけ読み込む）。未登録の id は reject する。
	 * 失敗したデッキは再度呼ぶと読み込み直す。
	 */
	load(id: string): Promise<OpenSlideModule> {
		const state = this.states.get(id);
		if (state?.status === "loaded") return Promise.resolve(state.module);
		if (state?.status === "loading") return state.promise;
		const deck = this.decks.get(id);
		if (!deck) return Promise.reject(new Error(`open-slide deck "${id}" is not registered`));
		const promise = deck.load().then(
			(module) => {
				this.states.set(id, { status: "loaded", module });
				this.emit();
				return module;
			},
			(error: unknown) => {
				this.states.set(id, { status: "error", error });
				this.emit();
				throw error;
			},
		);
		this.states.set(id, { status: "loading", promise });
		return promise;
	}

	/** 読み込み状態の変化を購読する（useSyncExternalStore にそのまま渡せる束縛済み関数）。 */
	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	private emit(): void {
		for (const l of this.listeners) l();
	}
}
