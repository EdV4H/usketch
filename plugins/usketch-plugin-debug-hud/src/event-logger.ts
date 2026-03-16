export interface EventLogEntry {
	event: string;
	timestamp: number;
	count: number;
}

const MAX_ENTRIES = 200;

export class EventLogger {
	private entries: EventLogEntry[] = [];
	private listeners = new Set<() => void>();
	private snapshotCache: readonly EventLogEntry[] = [];

	push(entry: { event: string; timestamp: number }): void {
		const last = this.entries[this.entries.length - 1];
		if (last && last.event === entry.event) {
			last.count++;
			last.timestamp = entry.timestamp;
		} else {
			this.entries.push({ ...entry, count: 1 });
			if (this.entries.length > MAX_ENTRIES) {
				this.entries.shift();
			}
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
