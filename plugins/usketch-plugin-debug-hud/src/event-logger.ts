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
	private rafId: number | null = null;
	private dirty = false;

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
		this.dirty = true;
		// Avoid scheduling rAF when no one is listening — keeps drag/idle paths cheap.
		if (this.listeners.size === 0) return;
		this.scheduleFlush();
	}

	clear(): void {
		this.entries = [];
		this.dirty = true;
		if (this.listeners.size === 0) {
			this.snapshotCache = [];
			this.dirty = false;
			return;
		}
		this.scheduleFlush();
	}

	subscribe(listener: () => void): () => void {
		// If entries accumulated while no one was listening, surface them to the
		// new subscriber on the next frame instead of waiting for another push.
		if (this.dirty && this.listeners.size === 0) {
			this.scheduleFlush();
		}
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
			if (this.listeners.size === 0 && this.rafId !== null) {
				cancelAnimationFrame(this.rafId);
				this.rafId = null;
			}
		};
	}

	getSnapshot(): readonly EventLogEntry[] {
		return this.snapshotCache;
	}

	dispose(): void {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.listeners.clear();
		this.dirty = false;
	}

	private scheduleFlush(): void {
		if (this.rafId !== null) return;
		this.rafId = requestAnimationFrame(() => {
			this.rafId = null;
			if (!this.dirty) return;
			this.dirty = false;
			this.snapshotCache = [...this.entries];
			for (const listener of this.listeners) {
				listener();
			}
		});
	}
}
