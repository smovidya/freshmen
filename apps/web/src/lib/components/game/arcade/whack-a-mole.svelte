<script lang="ts">
	// Fixed 3x3 grid; a mole pops up in a random empty-looking cell for a short
	// window and hides again whether tapped or not. rawScore = hits landed in
	// the round - reported once at game-over via onGameOver, same "one final
	// number" trust model as every other arcade game (see plan/arcade.ts).
	const GRID_SIZE = 9;
	const MOLE_VISIBLE_MS = 700;
	const SPAWN_INTERVAL_MS = 550;

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	let hits = $state(0);
	let activeCell = $state(-1);
	let remainingMs = $state(durationMs);
	let ended = $state(false);

	let spawnIntervalId: ReturnType<typeof setInterval> | undefined;
	let hideTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	const startedAt = Date.now();

	function spawnMole() {
		activeCell = Math.floor(Math.random() * GRID_SIZE);
		clearTimeout(hideTimeoutId);
		hideTimeoutId = setTimeout(() => {
			activeCell = -1;
		}, MOLE_VISIBLE_MS);
	}

	function whack(cell: number) {
		if (ended || cell !== activeCell) return;
		hits += 1;
		activeCell = -1;
		clearTimeout(hideTimeoutId);
	}

	function endRound() {
		if (ended) return;
		ended = true;
		activeCell = -1;
		clearInterval(spawnIntervalId);
		clearInterval(tickIntervalId);
		clearTimeout(hideTimeoutId);
		onGameOver(hits);
	}

	$effect(() => {
		spawnIntervalId = setInterval(spawnMole, SPAWN_INTERVAL_MS);
		tickIntervalId = setInterval(() => {
			remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
			if (remainingMs <= 0) endRound();
		}, 100);

		return () => {
			clearInterval(spawnIntervalId);
			clearInterval(tickIntervalId);
			clearTimeout(hideTimeoutId);
		};
	});
</script>

<div class="flex w-full flex-col items-center gap-5">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>ตี: {hits}</span>
		<span>{(remainingMs / 1000).toFixed(1)}s</span>
	</div>
	<div class="grid w-full max-w-xs grid-cols-3 gap-3">
		{#each Array(GRID_SIZE) as _, cell (cell)}
			<button
				type="button"
				onclick={() => whack(cell)}
				class="aspect-square rounded-2xl border-2 border-black bg-[#c7f9cc] text-3xl shadow-[3px_3px_0_#111827] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
			>
				{activeCell === cell ? '🐹' : ''}
			</button>
		{/each}
	</div>
</div>
