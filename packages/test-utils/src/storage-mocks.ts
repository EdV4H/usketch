import { vi } from "vitest";

/**
 * ストレージ関連のモック
 * 既存のsrc/test/utils.tsから移行・拡張
 */

/**
 * Mock localStorage for testing
 */
export function mockLocalStorage(): Storage {
	const store: Record<string, string> = {};

	const storage = {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			Object.keys(store).forEach((key) => {
				delete store[key];
			});
		}),
		key: vi.fn((index: number) => {
			const keys = Object.keys(store);
			return keys[index] || null;
		}),
		get length() {
			return Object.keys(store).length;
		},
	};

	return storage as Storage;
}

/**
 * Mock sessionStorage for testing
 */
export function mockSessionStorage(): Storage {
	return mockLocalStorage(); // 同じ実装を使用
}

/**
 * Create a storage with initial data
 */
export function createStorageWithData(initialData: Record<string, any>): Storage {
	const storage = mockLocalStorage();

	Object.entries(initialData).forEach(([key, value]) => {
		storage.setItem(key, JSON.stringify(value));
	});

	return storage;
}

/**
 * Mock IndexedDB
 */
export function mockIndexedDB(): {
	db: IDBDatabase;
	objectStore: IDBObjectStore;
	transaction: IDBTransaction;
} {
	const objectStore = {
		add: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() })),
		put: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() })),
		get: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() })),
		delete: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() })),
		clear: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() })),
		getAll: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() })),
		count: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() })),
		createIndex: vi.fn(),
		index: vi.fn(),
		deleteIndex: vi.fn(),
	};

	const transaction = {
		objectStore: vi.fn(() => objectStore),
		abort: vi.fn(),
		oncomplete: vi.fn(),
		onerror: vi.fn(),
		onabort: vi.fn(),
	};

	const db = {
		createObjectStore: vi.fn(() => objectStore),
		deleteObjectStore: vi.fn(),
		transaction: vi.fn(() => transaction),
		close: vi.fn(),
		name: "mockDB",
		version: 1,
		objectStoreNames: ["mockStore"],
	};

	return {
		db: db as unknown as IDBDatabase,
		objectStore: objectStore as unknown as IDBObjectStore,
		transaction: transaction as unknown as IDBTransaction,
	};
}

/**
 * Storage event emitter for cross-tab communication testing
 */
export class StorageEventEmitter {
	private listeners: Array<(event: StorageEvent) => void> = [];

	constructor(private storage: Storage) {}

	addEventListener(callback: (event: StorageEvent) => void): void {
		this.listeners.push(callback);
	}

	removeEventListener(callback: (event: StorageEvent) => void): void {
		this.listeners = this.listeners.filter((listener) => listener !== callback);
	}

	emit(key: string, oldValue: string | null, newValue: string | null): void {
		const event = new StorageEvent("storage", {
			key,
			oldValue,
			newValue,
			url: window.location.href,
			storageArea: this.storage,
		});

		this.listeners.forEach((listener) => {
			listener(event);
		});
	}
}

/**
 * Create a persistent storage mock
 */
export function createPersistentStorage(): {
	storage: Storage;
	persist: () => Record<string, string>;
	restore: (data: Record<string, string>) => void;
} {
	const storage = mockLocalStorage();
	let persistedData: Record<string, string> = {};

	return {
		storage,
		persist: () => {
			persistedData = {};
			for (let i = 0; i < storage.length; i++) {
				const key = storage.key(i);
				if (key) {
					const value = storage.getItem(key);
					if (value !== null) {
						persistedData[key] = value;
					}
				}
			}
			return persistedData;
		},
		restore: (data: Record<string, string>) => {
			storage.clear();
			Object.entries(data).forEach(([key, value]) => {
				storage.setItem(key, value);
			});
		},
	};
}

/**
 * Storage quota mock
 */
export function mockStorageQuota(): {
	estimate: () => Promise<StorageEstimate>;
	persist: () => Promise<boolean>;
	persisted: () => Promise<boolean>;
} {
	return {
		estimate: vi.fn(async () => ({
			usage: 1024 * 1024, // 1MB
			quota: 1024 * 1024 * 1024, // 1GB
		})),
		persist: vi.fn(async () => true),
		persisted: vi.fn(async () => true),
	};
}

/**
 * Install storage mocks globally
 */
export function installStorageMocks(): {
	localStorage: Storage;
	sessionStorage: Storage;
	cleanup: () => void;
} {
	const originalLocalStorage = window.localStorage;
	const originalSessionStorage = window.sessionStorage;

	const localStorageMock = mockLocalStorage();
	const sessionStorageMock = mockSessionStorage();

	Object.defineProperty(window, "localStorage", {
		value: localStorageMock,
		writable: true,
		configurable: true,
	});

	Object.defineProperty(window, "sessionStorage", {
		value: sessionStorageMock,
		writable: true,
		configurable: true,
	});

	return {
		localStorage: localStorageMock,
		sessionStorage: sessionStorageMock,
		cleanup: () => {
			Object.defineProperty(window, "localStorage", {
				value: originalLocalStorage,
				writable: true,
				configurable: true,
			});
			Object.defineProperty(window, "sessionStorage", {
				value: originalSessionStorage,
				writable: true,
				configurable: true,
			});
		},
	};
}
