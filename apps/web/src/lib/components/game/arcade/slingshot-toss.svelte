<script lang="ts">
	// A power marker sweeps back and forth along a bar; tap to release the
	// shot at the target zone. Ramp: each attempt sweeps faster and the
	// target zone shrinks, so the first toss is forgiving and the last is a
	// sliver. rawScore = best accuracy (0-100) reached across every attempt
	// in the round - reported once at game-over via onGameOver, on hitting
	// the overall duration cap (see plan/arcade.ts).
	const BAR_WIDTH = 260;
	const SWEEP_SPEED_START = 220; // px/s
	const SWEEP_SPEED_MAX = 520;
	const SPEED_RAMP_ATTEMPTS = 8;
	const TARGET_WIDTH_START = 70;
	const TARGET_WIDTH_MIN = 22;
	const TARGET_SHRINK_ATTEMPTS = 8;
	const RESULT_PAUSE_MS = 550;

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	let markerX = $state(0);
	let direction = 1;
	let attempts = $state(0);
	let bestAccuracy = $state(0);
	let lastAccuracy = $state<number | null>(null);
	let targetCenter = $state(BAR_WIDTH / 2);
	let targetWidth = $state(TARGET_WIDTH_START);
	let remainingMs = $state(durationMs);
	let locked = $state(false);
	let ended = false;

	let rafId = 0;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	let lastFrameAt = 0;
	const startedAt = Date.now();

	function paramsForAttempt(attempt: number) {
		const speedT = Math.min(1, attempt / SPEED_RAMP_ATTEMPTS);
		const widthT = Math.min(1, attempt / TARGET_SHRINK_ATTEMPTS);
		return {
			speed: SWEEP_SPEED_START + speedT * (SWEEP_SPEED_MAX - SWEEP_SPEED_START),
			width: TARGET_WIDTH_START - widthT * (TARGET_WIDTH_START - TARGET_WIDTH_MIN)
		};
	}

	function newTarget() {
		const { width } = paramsForAttempt(attempts);
		targetWidth = width;
		targetCenter = width / 2 + Math.random() * (BAR_WIDTH - width);
	}

	function frame(now: number) {
		if (ended || locked) return;
		if (!lastFrameAt) lastFrameAt = now;
		const dt = (now - lastFrameAt) / 1000;
		lastFrameAt = now;

		const { speed } = paramsForAttempt(attempts);
		let next = markerX + direction * speed * dt;
		if (next < 0) {
			next = 0;
			direction = 1;
		} else if (next > BAR_WIDTH) {
			next = BAR_WIDTH;
			direction = -1;
		}
		markerX = next;
		rafId = requestAnimationFrame(frame);
	}

	function endRound() {
		if (ended) return;
		ended = true;
		cancelAnimationFrame(rafId);
		clearInterval(tickIntervalId);
		onGameOver(Math.round(bestAccuracy));
	}

	function release() {
		if (ended || locked) return;
		locked = true;
		const distance = Math.abs(markerX - targetCenter);
		const accuracy = Math.max(0, 100 * (1 - distance / (targetWidth * 1.8 + 40)));
		lastAccuracy = Math.round(accuracy);
		bestAccuracy = Math.max(bestAccuracy, accuracy);
		attempts += 1;

		setTimeout(() => {
			if (ended) return;
			newTarget();
			lastFrameAt = 0;
			locked = false;
			rafId = requestAnimationFrame(frame);
		}, RESULT_PAUSE_MS);
	}

	$effect(() => {
		newTarget();
		rafId = requestAnimationFrame(frame);
		tickIntervalId = setInterval(() => {
			remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
			if (remainingMs <= 0) endRound();
		}, 150);

		return () => {
			cancelAnimationFrame(rafId);
			clearInterval(tickIntervalId);
		};
	});
</script>

<div class="flex w-full flex-col items-center gap-5">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>แม่นสุด: {Math.round(bestAccuracy)}%</span>
		<span>{(remainingMs / 1000).toFixed(0)}s</span>
	</div>
	{#if lastAccuracy !== null}
		<p class="text-sm font-medium text-[#62748e]">ครั้งล่าสุด: {lastAccuracy}%</p>
	{/if}
	<div
		class="relative h-8 rounded-full border-2 border-black bg-[#eef2ff]"
		style="width: {BAR_WIDTH}px;"
	>
		<div
			class="absolute top-0 h-full rounded-full bg-[#c7f9cc]"
			style="left: {targetCenter - targetWidth / 2}px; width: {targetWidth}px;"
		></div>
		<div
			class="absolute top-1/2 h-6 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black"
			style="left: {markerX}px;"
		></div>
	</div>
	<button
		type="button"
		onclick={release}
		disabled={locked}
		class="rounded-full border-2 border-black bg-[#ff7a59] px-6 py-3 font-black text-white shadow-[3px_3px_0_#111827] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
	>
		ปล่อย!
	</button>
</div>
