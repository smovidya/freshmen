<script lang="ts">
	import { untrack } from 'svelte';

	// A power marker sweeps back and forth along a bar; tap to release the
	// shot at the target zone. Ramp: each attempt sweeps faster and the
	// target zone shrinks, so the first toss is forgiving and the last is a
	// sliver. rawScore = best accuracy (0-100) reached across every attempt
	// in the round - reported once at game-over via onGameOver, on hitting
	// the overall duration cap (see plan/arcade.ts).
	//
	// Gimmicks (cosmetic/meta only - never touch rawScore, which stays the
	// true bestAccuracy): a flying-ball animation on release (the game's
	// named "slingshot toss" but had no actual toss to look at), a combo
	// streak counter that grows on back-to-back 80%+ shots and resets on a
	// bad one, and a "CRITICAL!" flash + brief screen-shake on 95%+.
	const BAR_WIDTH = 260;
	const SWEEP_SPEED_START = 220; // px/s
	const SWEEP_SPEED_MAX = 520;
	const SPEED_RAMP_ATTEMPTS = 8;
	const TARGET_WIDTH_START = 70;
	const TARGET_WIDTH_MIN = 22;
	const TARGET_SHRINK_ATTEMPTS = 8;
	const RESULT_PAUSE_MS = 550;
	const STREAK_THRESHOLD = 80;
	const CRITICAL_THRESHOLD = 95;
	const FLIGHT_MS = 320;

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
	let streak = $state(0);
	let shot = $state<{ id: number; x: number } | null>(null);
	let critical = $state(false);
	let ended = false;

	let nextShotId = 0;
	let criticalTimeoutId: ReturnType<typeof setTimeout> | undefined;

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
		clearTimeout(criticalTimeoutId);
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

		streak = accuracy >= STREAK_THRESHOLD ? streak + 1 : 0;

		shot = { id: nextShotId++, x: markerX };
		critical = accuracy >= CRITICAL_THRESHOLD;
		if (critical) {
			clearTimeout(criticalTimeoutId);
			criticalTimeoutId = setTimeout(() => (critical = false), RESULT_PAUSE_MS);
		}

		setTimeout(() => {
			if (ended) return;
			shot = null;
			newTarget();
			lastFrameAt = 0;
			locked = false;
			rafId = requestAnimationFrame(frame);
		}, RESULT_PAUSE_MS);
	}

	$effect(() => {
		// untrack: newTarget reads `attempts` synchronously - without this,
		// every later write to `attempts` (every release) reruns this whole
		// effect, resetting the target and stacking a second RAF loop on top
		// of the existing one. Same trap in simon-says.svelte and
		// flappy-runner.svelte, fixed the same way.
		untrack(() => newTarget());
		rafId = requestAnimationFrame(frame);
		tickIntervalId = setInterval(() => {
			remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
			if (remainingMs <= 0) endRound();
		}, 150);

		return () => {
			cancelAnimationFrame(rafId);
			clearInterval(tickIntervalId);
			clearTimeout(criticalTimeoutId);
		};
	});
</script>

<div class="flex w-full flex-col items-center gap-5" class:critical-shake={critical}>
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>แม่นสุด: {Math.round(bestAccuracy)}%</span>
		<span>{(remainingMs / 1000).toFixed(0)}s</span>
	</div>
	<div class="flex h-10 flex-col items-center justify-center gap-0.5">
		{#if critical}
			<p class="critical-pop text-lg font-black text-[#ff7a59]">CRITICAL!</p>
		{:else if lastAccuracy !== null}
			<p class="text-sm font-medium text-[#62748e]">ครั้งล่าสุด: {lastAccuracy}%</p>
		{/if}
		{#if streak >= 2}
			<p class="text-xs font-black text-[#ff9f59]">🔥 ต่อเนื่อง x{streak}</p>
		{/if}
	</div>
	<div
		class="relative h-8 rounded-full border-2 border-black bg-[#eef2ff]"
		style="width: {BAR_WIDTH}px;"
	>
		<!-- Slingshot rig: purely decorative, marks the launch end of the bar -->
		<div
			class="pointer-events-none absolute top-1/2 -left-7 -translate-y-1/2 text-xl"
			aria-hidden="true"
		>
			🪀
		</div>
		<div
			class="absolute top-0 h-full rounded-full bg-[#c7f9cc]"
			style="left: {targetCenter - targetWidth / 2}px; width: {targetWidth}px;"
		></div>
		{#if shot}
			{#key shot.id}
				<div
					class="shot-ball pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 rounded-full border-2 border-black bg-[#ff7a59]"
					style="--shot-dx: {shot.x}px; animation-duration: {FLIGHT_MS}ms;"
					aria-hidden="true"
				></div>
			{/key}
		{/if}
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

<style>
	.shot-ball {
		animation-name: shot-arc;
		animation-timing-function: ease-out;
		animation-fill-mode: forwards;
	}

	@keyframes shot-arc {
		0% {
			transform: translate(0, -50%) scale(0.7);
		}
		50% {
			transform: translate(calc(var(--shot-dx) * 0.5), calc(-50% - 26px)) scale(1.15);
		}
		100% {
			transform: translate(var(--shot-dx), -50%) scale(1);
		}
	}

	.critical-pop {
		animation: critical-pop 0.4s ease-out;
	}

	@keyframes critical-pop {
		0% {
			transform: scale(0.6);
			opacity: 0;
		}
		40% {
			transform: scale(1.15);
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.critical-shake {
		animation: critical-shake 0.35s ease-in-out;
	}

	@keyframes critical-shake {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(-4px);
		}
		75% {
			transform: translateX(4px);
		}
	}
</style>
