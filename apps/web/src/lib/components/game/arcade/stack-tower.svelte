<script lang="ts">
	// Classic "Stack": a block slides left-right, tap to drop it - overhang
	// past the block below gets trimmed off, miss entirely and the tower
	// falls. Ramp is the genre's own convention: the slider speeds up with
	// every successful floor, so early drops are lazy and later ones are a
	// blur. rawScore = floors stacked - reported once at game-over via
	// onGameOver, on a total miss or on hitting the overall duration cap
	// (see plan/arcade.ts).
	const TRACK_WIDTH = 260;
	const BLOCK_HEIGHT = 22;
	const START_WIDTH = 140;
	const SPEED_START = 90; // px/s
	const SPEED_MAX = 260;
	const SPEED_RAMP_FLOORS = 20; // floors at which speed maxes out

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	type Block = { left: number; width: number };

	let stack = $state<Block[]>([{ left: (TRACK_WIDTH - START_WIDTH) / 2, width: START_WIDTH }]);
	let moving = $state<Block>({ left: 0, width: START_WIDTH });
	let direction = 1;
	let remainingMs = $state(durationMs);
	let floors = $state(0);
	let ended = false;

	let rafId = 0;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	let lastFrameAt = 0;
	const startedAt = Date.now();

	function speedForFloor(floor: number) {
		const t = Math.min(1, floor / SPEED_RAMP_FLOORS);
		return SPEED_START + t * (SPEED_MAX - SPEED_START);
	}

	function frame(now: number) {
		if (ended) return;
		if (!lastFrameAt) lastFrameAt = now;
		const dt = (now - lastFrameAt) / 1000;
		lastFrameAt = now;

		const speed = speedForFloor(floors);
		let nextLeft = moving.left + direction * speed * dt;
		const maxLeft = TRACK_WIDTH - moving.width;
		if (nextLeft < 0) {
			nextLeft = 0;
			direction = 1;
		} else if (nextLeft > maxLeft) {
			nextLeft = maxLeft;
			direction = -1;
		}
		moving = { ...moving, left: nextLeft };
		rafId = requestAnimationFrame(frame);
	}

	function drop() {
		if (ended) return;
		const below = stack[stack.length - 1]!;
		const overlapLeft = Math.max(moving.left, below.left);
		const overlapRight = Math.min(moving.left + moving.width, below.left + below.width);
		const overlapWidth = overlapRight - overlapLeft;

		if (overlapWidth <= 4) {
			endRound();
			return;
		}

		const landed = { left: overlapLeft, width: overlapWidth };
		stack = [...stack, landed];
		floors += 1;
		lastFrameAt = 0;
		direction = Math.random() < 0.5 ? 1 : -1;
		moving = {
			left: direction === 1 ? 0 : TRACK_WIDTH - landed.width,
			width: landed.width
		};
	}

	function endRound() {
		if (ended) return;
		ended = true;
		cancelAnimationFrame(rafId);
		clearInterval(tickIntervalId);
		onGameOver(floors);
	}

	$effect(() => {
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
		<span>ชั้น: {floors}</span>
		<span>{(remainingMs / 1000).toFixed(0)}s</span>
	</div>
	<button
		type="button"
		onclick={drop}
		class="relative overflow-hidden rounded-2xl border-2 border-black bg-[#eef2ff]"
		style="width: {TRACK_WIDTH}px; height: {Math.min(
			360,
			40 + stack.length * BLOCK_HEIGHT + BLOCK_HEIGHT
		)}px;"
	>
		{#each stack as block, i (i)}
			<div
				class="absolute rounded-sm border border-black/60 bg-[#bde0fe]"
				style="left: {block.left}px; width: {block.width}px; height: {BLOCK_HEIGHT -
					2}px; bottom: {i * BLOCK_HEIGHT}px;"
			></div>
		{/each}
		<div
			class="absolute rounded-sm border border-black bg-[#ff7a59]"
			style="left: {moving.left}px; width: {moving.width}px; height: {BLOCK_HEIGHT -
				2}px; bottom: {stack.length * BLOCK_HEIGHT}px;"
		></div>
	</button>
	<p class="text-xs text-[#62748e]">แตะเพื่อวางบล็อก</p>
</div>
