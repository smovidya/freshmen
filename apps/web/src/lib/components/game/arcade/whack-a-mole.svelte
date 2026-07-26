<script lang="ts">
	// Fixed 3x3 grid; moles pop up in random empty cells for a shrinking
	// window and hide again whether tapped or not. Ramps up over the round
	// (more moles at once, each visible for less time) so it's not just "tap
	// the one obvious mole" the whole way through. rawScore = hits landed -
	// reported once at game-over via onGameOver, same "one final number"
	// trust model as every other arcade game (see plan/arcade.ts).
	const GRID_SIZE = 9;
	const TICK_MS = 150;

	// Difficulty ramp, keyed by how far through the round we are (0 at start,
	// 1 at the buzzer): concurrent moles 1 -> 3, each visible 700ms -> 320ms.
	const MIN_CONCURRENT_MOLES = 1;
	const MAX_CONCURRENT_MOLES = 3;
	const MOLE_VISIBLE_START_MS = 700;
	const MOLE_VISIBLE_END_MS = 320;

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	let hits = $state(0);
	let activeCells = $state(new Set<number>());
	let remainingMs = $state(durationMs);
	let ended = $state(false);

	const hideTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	const startedAt = Date.now();

	function hideMole(cell: number) {
		activeCells.delete(cell);
		activeCells = new Set(activeCells);
		hideTimeouts.delete(cell);
	}

	function spawnMole(visibleMs: number) {
		const emptyCells = Array.from({ length: GRID_SIZE }, (_, i) => i).filter(
			(cell) => !activeCells.has(cell)
		);
		if (emptyCells.length === 0) return;
		const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)]!;
		activeCells.add(cell);
		activeCells = new Set(activeCells);
		hideTimeouts.set(
			cell,
			setTimeout(() => hideMole(cell), visibleMs)
		);
	}

	function whack(cell: number) {
		if (ended || !activeCells.has(cell)) return;
		hits += 1;
		clearTimeout(hideTimeouts.get(cell));
		hideMole(cell);
	}

	function endRound() {
		if (ended) return;
		ended = true;
		activeCells = new Set();
		clearInterval(tickIntervalId);
		for (const timeoutId of hideTimeouts.values()) clearTimeout(timeoutId);
		hideTimeouts.clear();
		onGameOver(hits);
	}

	$effect(() => {
		tickIntervalId = setInterval(() => {
			const elapsed = Date.now() - startedAt;
			remainingMs = Math.max(0, durationMs - elapsed);
			if (remainingMs <= 0) {
				endRound();
				return;
			}

			const progress = Math.min(1, elapsed / durationMs);
			const targetMoles =
				MIN_CONCURRENT_MOLES +
				Math.floor(progress * (MAX_CONCURRENT_MOLES - MIN_CONCURRENT_MOLES + 1));
			const visibleMs =
				MOLE_VISIBLE_START_MS - progress * (MOLE_VISIBLE_START_MS - MOLE_VISIBLE_END_MS);

			while (activeCells.size < Math.min(targetMoles, GRID_SIZE - 1)) {
				spawnMole(visibleMs);
			}
		}, TICK_MS);

		return () => {
			clearInterval(tickIntervalId);
			for (const timeoutId of hideTimeouts.values()) clearTimeout(timeoutId);
			hideTimeouts.clear();
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
				{activeCells.has(cell) ? '🐹' : ''}
			</button>
		{/each}
	</div>
</div>
