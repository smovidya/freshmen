import { apiClient, call } from './api';
import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';

const SCHEDULE_INTERVAL_MS = 20 * 60 * 1000;
export const VISIBLE_WINDOW_MS = 30 * 1000;

// Secret QTE popup timer. Client owns *when* to show the banner (this
// 20-minute setTimeout); the server (packages/server/services/qte.service.ts)
// owns *whether* a session can actually be minted, so a scripted client
// calling schedule/claim on its own cadence gets nothing extra out of it.
//
// Same interval/cleanup class shape as GamePopper in game.svelte.ts: interval
// ids as private fields, a public destroy() invoked from the owning
// component's onMount cleanup-return.
export class QteScheduler {
	#client = apiClient();

	visible = $state(false);
	remainingMs = $state(VISIBLE_WINDOW_MS);

	#sessionId: string | null = null;
	#scheduleTimeoutId: ReturnType<typeof setTimeout> | undefined;
	#countdownIntervalId: ReturnType<typeof setInterval> | undefined;

	// Absolute epoch-ms deadlines, not remaining durations - lets pause/resume
	// just diff against Date.now() instead of tracking elapsed time by hand.
	#windowDeadline = 0;
	#scheduleDeadline = 0;
	#remainingScheduleMs = SCHEDULE_INTERVAL_MS;
	#paused = false;

	#onVisibilityChange = () => {
		if (document.hidden) {
			this.#pause();
		} else {
			this.#resume();
		}
	};

	start() {
		this.#scheduleNext(SCHEDULE_INTERVAL_MS);
		document.addEventListener('visibilitychange', this.#onVisibilityChange);
	}

	destroy() {
		clearTimeout(this.#scheduleTimeoutId);
		clearInterval(this.#countdownIntervalId);
		document.removeEventListener('visibilitychange', this.#onVisibilityChange);
	}

	// Freeze (not drain) whichever timer is currently running while the tab is
	// hidden - a user can't see or click a popup they can't see, so letting
	// its 30s window silently expire in the background would be unfair, and
	// there's no reason to burn down the 20-min wait either.
	#pause() {
		if (this.#paused) return;
		this.#paused = true;
		if (this.visible) {
			clearInterval(this.#countdownIntervalId);
			this.remainingMs = Math.max(0, this.#windowDeadline - Date.now());
		} else {
			clearTimeout(this.#scheduleTimeoutId);
			this.#remainingScheduleMs = Math.max(0, this.#scheduleDeadline - Date.now());
		}
	}

	#resume() {
		if (!this.#paused) return;
		this.#paused = false;
		if (this.visible) {
			this.#windowDeadline = Date.now() + this.remainingMs;
			this.#tickCountdown();
		} else {
			this.#scheduleNext(this.#remainingScheduleMs);
		}
	}

	#scheduleNext(delayMs: number) {
		this.#scheduleDeadline = Date.now() + delayMs;
		this.#scheduleTimeoutId = setTimeout(() => this.#fire(), delayMs);
	}

	async #fire() {
		try {
			const session = await call(this.#client.game.qte.schedule.$post());
			this.#sessionId = session.id;
			this.visible = true;
			this.#windowDeadline = Date.now() + VISIBLE_WINDOW_MS;
			this.remainingMs = VISIBLE_WINDOW_MS;
			this.#tickCountdown();
		} catch {
			// Server declined (too soon since the last one, or the flag's off) -
			// this is a secret feature, so failures stay silent, just reschedule.
			this.#scheduleNext(SCHEDULE_INTERVAL_MS);
		}
	}

	#tickCountdown() {
		clearInterval(this.#countdownIntervalId);
		this.#countdownIntervalId = setInterval(() => {
			this.remainingMs = Math.max(0, this.#windowDeadline - Date.now());
			if (this.remainingMs <= 0) this.#hide();
		}, 100);
	}

	#hide() {
		clearInterval(this.#countdownIntervalId);
		this.visible = false;
		this.#sessionId = null;
		this.#scheduleNext(SCHEDULE_INTERVAL_MS);
	}

	async claim() {
		if (!this.#sessionId) return;
		const id = this.#sessionId;
		this.#hide();
		try {
			const result = await call(this.#client.game.qte.claim.$post({ json: { id } }));
			toast.success('ได้รับมินิเกมฟรี!');
			await goto(`/game/minigames/${result.gameType}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'พลาดแล้ว ลองรอบถัดไปนะ');
		}
	}
}
