<script lang="ts">
	import { untrack } from 'svelte';

	// Tap to hop, gravity pulls back down, dodge the gaps scrolling in from
	// the right. Ramp over the run: obstacles scroll faster and the gap
	// shrinks as more get passed, so the whole thing gets tighter and faster
	// the longer you survive. rawScore = obstacles passed - reported once at
	// game-over via onGameOver, on collision or on hitting the overall
	// duration cap (see plan/arcade.ts).
	const AREA_WIDTH = 280;
	const AREA_HEIGHT = 380;
	const BIRD_SIZE = 26;
	const BIRD_X = 56;
	const GRAVITY = 900; // px/s^2
	const JUMP_VELOCITY = -320; // px/s
	const PIPE_WIDTH = 46;
	const SPACING_PX = 210;
	const SPEED_START = 110; // px/s
	const SPEED_MAX = 240;
	const SPEED_RAMP_PASSED = 40;
	const GAP_START = 150;
	const GAP_MIN = 100;
	const GAP_SHRINK_PASSED = 30;

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	type Pipe = { id: number; x: number; gapTop: number; gapHeight: number; passed: boolean };

	let birdY = $state(AREA_HEIGHT / 2);
	let velocity = $state(0);
	let pipes = $state<Pipe[]>([]);
	let passedCount = $state(0);
	let remainingMs = $state(durationMs);
	let ended = false;
	// Bird hovers in place (no gravity, pipes hold still) until the first
	// tap - so a fresh round doesn't drop the player before they're ready.
	let flying = false;

	let nextId = 0;
	let rafId = 0;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	let lastFrameAt = 0;
	const startedAt = Date.now();

	function speedForPassed(passed: number) {
		const t = Math.min(1, passed / SPEED_RAMP_PASSED);
		return SPEED_START + t * (SPEED_MAX - SPEED_START);
	}

	function gapForPassed(passed: number) {
		const t = Math.min(1, passed / GAP_SHRINK_PASSED);
		return GAP_START - t * (GAP_START - GAP_MIN);
	}

	function spawnPipe(fromX: number) {
		const gapHeight = gapForPassed(passedCount);
		const gapTop = 30 + Math.random() * (AREA_HEIGHT - 60 - gapHeight);
		pipes = [...pipes, { id: nextId++, x: fromX, gapTop, gapHeight, passed: false }];
	}

	function endRound() {
		if (ended) return;
		ended = true;
		cancelAnimationFrame(rafId);
		clearInterval(tickIntervalId);
		onGameOver(passedCount);
	}

	function frame(now: number) {
		if (ended) return;
		if (!lastFrameAt) lastFrameAt = now;
		const dt = Math.min(0.05, (now - lastFrameAt) / 1000);
		lastFrameAt = now;

		if (!flying) {
			rafId = requestAnimationFrame(frame);
			return;
		}

		velocity += GRAVITY * dt;
		birdY += velocity * dt;

		if (birdY < 0 || birdY + BIRD_SIZE > AREA_HEIGHT) {
			endRound();
			return;
		}

		const speed = speedForPassed(passedCount);
		let updated = pipes.map((pipe) => ({ ...pipe, x: pipe.x - speed * dt }));

		for (const pipe of updated) {
			if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
				pipe.passed = true;
				passedCount += 1;
			}
			const withinX = BIRD_X + BIRD_SIZE > pipe.x && BIRD_X < pipe.x + PIPE_WIDTH;
			if (withinX) {
				const hitsTop = birdY < pipe.gapTop;
				const hitsBottom = birdY + BIRD_SIZE > pipe.gapTop + pipe.gapHeight;
				if (hitsTop || hitsBottom) {
					pipes = updated;
					endRound();
					return;
				}
			}
		}

		updated = updated.filter((pipe) => pipe.x + PIPE_WIDTH > -20);
		const rightmost = updated.length > 0 ? Math.max(...updated.map((p) => p.x)) : -SPACING_PX;
		if (AREA_WIDTH - rightmost >= SPACING_PX) {
			updated = [...updated, { id: nextId, x: AREA_WIDTH, gapTop: 0, gapHeight: 0, passed: false }];
			nextId += 1;
			const gapHeight = gapForPassed(passedCount);
			const gapTop = 30 + Math.random() * (AREA_HEIGHT - 60 - gapHeight);
			updated[updated.length - 1] = { ...updated[updated.length - 1]!, gapTop, gapHeight };
		}

		pipes = updated;
		rafId = requestAnimationFrame(frame);
	}

	function hop() {
		if (ended) return;
		flying = true;
		velocity = JUMP_VELOCITY;
	}

	$effect(() => {
		// untrack: spawnPipe reads+writes `pipes` synchronously - without
		// this, every later write to `pipes` (every animation frame) reruns
		// this whole effect, spawning an extra pipe and a second RAF loop on
		// top of the existing one, every frame. Same trap in
		// simon-says.svelte and slingshot-toss.svelte, fixed the same way.
		untrack(() => spawnPipe(AREA_WIDTH + 80));
		rafId = requestAnimationFrame(frame);
		tickIntervalId = setInterval(() => {
			remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
			if (remainingMs <= 0) endRound();
		}, 200);

		return () => {
			cancelAnimationFrame(rafId);
			clearInterval(tickIntervalId);
		};
	});
</script>

<div class="flex w-full flex-col items-center gap-4">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>ผ่านด่าน: {passedCount}</span>
		<span>{(remainingMs / 1000).toFixed(0)}s</span>
	</div>
	<button
		type="button"
		onclick={hop}
		class="relative overflow-hidden rounded-2xl border-2 border-black bg-[#bde0fe]"
		style="width: {AREA_WIDTH}px; height: {AREA_HEIGHT}px;"
	>
		{#each pipes as pipe (pipe.id)}
			<div
				class="absolute top-0 w-[46px] rounded-b-md bg-[#2d6a4f]"
				style="left: {pipe.x}px; height: {pipe.gapTop}px;"
			></div>
			<div
				class="absolute bottom-0 w-[46px] rounded-t-md bg-[#2d6a4f]"
				style="left: {pipe.x}px; height: {AREA_HEIGHT - pipe.gapTop - pipe.gapHeight}px;"
			></div>
		{/each}
		<div
			class="absolute rounded-full border-2 border-black bg-[#fdf886] text-center text-lg leading-[26px]"
			style="left: {BIRD_X}px; top: {birdY}px; width: {BIRD_SIZE}px; height: {BIRD_SIZE}px;"
		>
			✈️
		</div>
	</button>
	<p class="text-xs text-[#62748e]">แตะเพื่อบิน</p>
</div>
