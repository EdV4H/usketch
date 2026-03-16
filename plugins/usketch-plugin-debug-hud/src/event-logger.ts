export interface EventLogEntry {
	event: string;
	timestamp: number;
}

const MAX_ENTRIES = 50;

export class EventLogger {
	private entries: EventLogEntry[] = [];
	private listeners = new Set<() => void>();
	private snapshotCache: readonly EventLogEntry[] = [];

	push(entry: EventLogEntry): void {
		this.entries.push(entry);
		if (this.entries.length > MAX_ENTRIES) {
			this.entries.shift();
		}
		this.snapshotCache = [...this.entries];
		for (const listener of this.listeners) {
			listener();
		}
	}

	clear(): void {
		this.entries = [];
		this.snapshotCache = [];
		for (const listener of this.listeners) {
			listener();
		}
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getSnapshot(): readonly EventLogEntry[] {
		return this.snapshotCache;
	}
}
