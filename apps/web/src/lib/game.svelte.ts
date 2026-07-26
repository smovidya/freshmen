import { apiClient, call } from './api';
import { toast } from 'svelte-sonner';
import { dev } from '$app/environment';
import { untrack } from 'svelte';

export type DisplayPlayer = {
	playerId: string;
	displayName: string;
	score: number;
};

export type CentralGroupTotal = {
	groupNumber: string;
	groupLabel: string;
	totalScore: number;
};

export type MyGroupLeaderboard = {
	ownGroup: { groupNumber: string; groupLabel: string; top10: DisplayPlayer[] };
	central: CentralGroupTotal[];
};

export class GameAPIClient {
	#client = apiClient();

	// Cookie session is already available by the time this component mounts
	// (no async token handshake needed) - kept as a getter so callers that
	// waited on it (GamePopper.init) don't need to change.
	ready = true;

	// Single-use session token required by /game/pop, chained one-per-request
	// (see game.service.ts) - fetched separately so GamePopper can bootstrap
	// one before its first flush.
	async getPopToken(): Promise<string> {
		const { token } = await call(this.#client.game['pop-token'].$get());
		return token;
	}

	// Returns the amount the server actually credited (post token check,
	// elapsed-time throttle and active-buff accounting) plus the next token in
	// the chain - null on request failure (invalid/expired token included),
	// so the caller can reconcile its optimistic display instead of trusting
	// it and knows to fetch a fresh token before retrying.
	async submitPop(
		count: number,
		token: string
	): Promise<{ applied: number; nextToken: string } | null> {
		if (count === 0) {
			return null;
		}

		try {
			return await call(this.#client.game.pop.$post({ json: { pop: count, token } }));
		} catch (e) {
			toast.error('ไม่สามารถส่งข้อมูลได้');
			console.error(e);
			return null;
		}
	}

	async getLeaderboard(): Promise<MyGroupLeaderboard> {
		return call(this.#client.game.leaderboard.$get());
	}
}

export class GamePopper {
	flushIntervalId!: ReturnType<typeof setInterval>;
	// Raw tap count since last flush - this (not the multiplied display value)
	// is what gets sent to the server, since the server applies its own
	// authoritative multiplier accounting (packages/server/services/points.service.ts's
	// creditPoints). Multiplying here too would double-apply the buff.
	rawBatchedCount: number = $state(0);
	#serverCount = $state(0);
	// Set from the caller whenever the active buff changes (see game-on.svelte)
	// so displaySelfCount (and each tap's felt increment) reflects it in real
	// time - previously this was always 1:1 regardless of an active x3/x100
	// buff, so the boost was invisible until the next 5s poll silently caught
	// the total up.
	multiplier: number = $state(1);
	displaySelfCount = $derived(this.rawBatchedCount * this.multiplier + this.#serverCount);

	#client: GameAPIClient;
	// null = no usable token yet (not fetched, consumed by the last flush, or
	// invalidated by a failed request) - #flush fetches a fresh one on demand
	// rather than the interval loop needing to track this itself.
	#popToken: string | null = null;
	// Downward-sync guards (see syncServerCount): a flush in flight or recently
	// acknowledged means a lower polled balance is probably just a stale read
	// that predates the credit, not a real decrease.
	#flushInFlight = false;
	#lastFlushAckAt = 0;

	constructor(client: GameAPIClient) {
		this.#client = client;
		this.#serverCount = parseInt(localStorage.getItem('__pop_count') ?? '0') || 0;
	}

	async init() {
		try {
			this.#popToken = await this.#client.getPopToken();
		} catch (e) {
			console.error(e);
		}

		this.flushIntervalId = setInterval(
			() => {
				this.#flush();
			},
			// 10s (was 5s) in prod: each flush is a /game/pop POST fanning out to
			// several D1 writes (pop_sessions, points_balances, rate limits) per
			// player - halving the flush rate halves the write storm that was
			// starving session lookups. Taps still show instantly (optimistic).
			dev ? 1000 : 1000 * 10
		);
	}

	// Confirmed base count now comes from the shared PointsStore's balance
	// (game-on.svelte wires this up whenever points.balance changes) instead
	// of this class polling /game/stats/self on its own timer - that was a
	// second independent fetch of the exact same points balance, which could
	// land out of step with the shop drawer's PointsStore poll and show a
	// different number there than here.
	syncServerCount(balance: number) {
		if (balance > this.#serverCount) {
			this.#serverCount = balance;
			localStorage.setItem('__pop_count', String(balance));
			return;
		}
		// Also follow the balance DOWN, else this device's score diverges from
		// every other client: shop purchases spend the balance, and optimistic
		// credits the server rejected (e.g. during an outage) otherwise stick in
		// localStorage forever. Only when it can't be a stale read racing a
		// credit: no unflushed taps, no flush in flight, and the last accepted
		// flush is older than the balance poll interval.
		if (
			balance < this.#serverCount &&
			untrack(() => this.rawBatchedCount) === 0 &&
			!this.#flushInFlight &&
			Date.now() - this.#lastFlushAckAt > 20_000
		) {
			this.#serverCount = balance;
			localStorage.setItem('__pop_count', String(balance));
		}
	}

	private stop() {
		clearInterval(this.flushIntervalId);
	}

	pop() {
		this.rawBatchedCount += 1;
		localStorage.setItem('__pop_count', String(untrack(() => this.displaySelfCount)));
	}

	async #flush() {
		const batched = untrack(() => this.rawBatchedCount);
		if (batched === 0) return;
		this.#flushInFlight = true;
		try {
			// No usable token (first-ever flush, or the last one was consumed by a
			// failed/invalidated request) - fetch one before spending the batch.
			// Leaves rawBatchedCount untouched on failure so the taps aren't lost,
			// just retried on the next interval tick.
			let token = this.#popToken;
			if (!token) {
				try {
					token = await this.#client.getPopToken();
					this.#popToken = token;
				} catch (e) {
					console.error(e);
					return;
				}
			}

			const multiplierAtFlush = untrack(() => this.multiplier);
			const baseServerCount = untrack(() => this.#serverCount);
			// Optimistic: assumes the server applies the full multiplier (true
			// whenever a buff is active and the throttle isn't hit)
			// so the number doesn't dip while the request is in flight.
			this.#serverCount = baseServerCount + batched * multiplierAtFlush;
			this.rawBatchedCount = 0;

			const result = await this.#client.submitPop(batched, token);
			// Chain the next token regardless of outcome - null forces a fresh
			// fetch next time (e.g. this one was rejected as invalid/expired).
			this.#popToken = result?.nextToken ?? null;

			// Server is authoritative - if the elapsed-time throttle granted
			// less than the optimistic guess (or the request failed
			// outright), correct down now instead of leaving an inflated number
			// until the next balance poll silently catches it.
			const trueServerCount = baseServerCount + (result?.applied ?? 0);
			if (trueServerCount < this.#serverCount) {
				this.#serverCount = trueServerCount;
			}
			localStorage.setItem('__pop_count', String(untrack(() => this.displaySelfCount)));
		} finally {
			this.#flushInFlight = false;
			this.#lastFlushAckAt = Date.now();
		}
	}

	destroy() {
		this.#flush();
		this.stop();
	}
}
