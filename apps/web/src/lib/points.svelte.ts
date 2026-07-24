import { apiClient, call } from './api';

export type ActiveBuff = {
	buffType: string;
	multiplier: number;
	expiresAt: string;
	grantedAmount: number;
	capAmount: number;
} | null;

export type ClaimStatus = {
	available: boolean;
	nextClaimAt: string | null;
	amount: number;
	intervalMs: number;
};

export type PendingMilestone = { id: string; threshold: number; gameType: string };

export class PointsAPIClient {
	#client = apiClient();

	async getSelf() {
		return call(this.#client.points.self.$get()) as Promise<{ balance: number; activeBuff: ActiveBuff }>;
	}

	async getClaimStatus() {
		return call(this.#client.points.claim.$get()) as Promise<ClaimStatus>;
	}

	async claim() {
		return call(this.#client.points.claim.$post()) as Promise<{ amount: number }>;
	}

	// Also marks whatever it returns as notified server-side (atomic
	// claim-and-return) - call this only where you're prepared to act on every
	// row it hands back, since a second call won't see them again.
	async claimPendingMilestones() {
		return call(this.#client.points.milestones.pending.$get()) as Promise<PendingMilestone[]>;
	}
}

export class PointsStore {
	balance = $state(0);
	activeBuff = $state<ActiveBuff>(null);
	claimStatus = $state<ClaimStatus | null>(null);

	#client: PointsAPIClient;
	#pollIntervalId!: ReturnType<typeof setInterval>;
	#claimPollIntervalId!: ReturnType<typeof setInterval>;

	constructor(client = new PointsAPIClient()) {
		this.#client = client;
	}

	async refresh() {
		try {
			const self = await this.#client.getSelf();
			this.balance = self.balance;
			this.activeBuff = self.activeBuff;
		} catch {
			// transient network error - keep last known values, next poll retries
		}
	}

	async refreshClaimStatus() {
		try {
			this.claimStatus = await this.#client.getClaimStatus();
		} catch {
			// transient network error - keep last known value, next poll retries
		}
	}

	async claim() {
		const result = await this.#client.claim();
		await Promise.all([this.refresh(), this.refreshClaimStatus()]);
		return result;
	}

	startPolling(intervalMs = 5000) {
		this.refresh();
		this.#pollIntervalId = setInterval(() => this.refresh(), intervalMs);

		this.refreshClaimStatus();
		// Coarser interval - the countdown itself ticks client-side, this just
		// re-syncs in case of drift or a claim from another device.
		this.#claimPollIntervalId = setInterval(() => this.refreshClaimStatus(), 30_000);
	}

	stopPolling() {
		clearInterval(this.#pollIntervalId);
		clearInterval(this.#claimPollIntervalId);
	}
}
