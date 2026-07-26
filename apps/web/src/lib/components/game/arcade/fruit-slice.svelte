<script lang="ts">
	// Suitcases fall from the top; tap to "check them in" for a point. Bombs
	// fall too - tapping one scores nothing (no penalty, just a wasted tap).
	// Ramp over the round: items fall faster and more often, and more of them
	// are bombs, so late game is a much denser dodge-and-slice mess.
	// rawScore = suitcases checked in - reported once at game-over via
	// onGameOver (see plan/arcade.ts).
	const SPAWN_INTERVAL_START_MS = 800;
	const SPAWN_INTERVAL_END_MS = 280;
	const FALL_DURATION_START_MS = 2_600;
	const FALL_DURATION_END_MS = 1_300;
	const BOMB_CHANCE_START = 0.08;
	const BOMB_CHANCE_END = 0.35;

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	type FallingItem = { id: number; x: number; isBomb: boolean; fallMs: number };

	let hits = $state(0);
	let items = $state<FallingItem[]>([]);
	let remainingMs = $state(durationMs);
	let ended = $state(false);

	let nextId = 0;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	let lastSpawnAt = 0;
	const startedAt = Date.now();

	function slice(item: FallingItem) {
		if (ended) return;
		const before = items.length;
		items = items.filter((i) => i.id !== item.id);
		if (items.length < before && !item.isBomb) hits += 1;
	}

	function despawn(id: number) {
		items = items.filter((i) => i.id !== id);
	}

	function endRound() {
		if (ended) return;
		ended = true;
		items = [];
		clearInterval(tickIntervalId);
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
			const spawnInterval =
				SPAWN_INTERVAL_START_MS - progress * (SPAWN_INTERVAL_START_MS - SPAWN_INTERVAL_END_MS);
			const fallMs =
				FALL_DURATION_START_MS - progress * (FALL_DURATION_START_MS - FALL_DURATION_END_MS);
			const bombChance = BOMB_CHANCE_START + progress * (BOMB_CHANCE_END - BOMB_CHANCE_START);

			if (elapsed - lastSpawnAt >= spawnInterval) {
				lastSpawnAt = elapsed;
				const id = nextId++;
				const isBomb = Math.random() < bombChance;
				items = [...items, { id, x: 6 + Math.random() * 86, isBomb, fallMs }];
				setTimeout(() => despawn(id), fallMs);
			}
		}, 80);

		return () => clearInterval(tickIntervalId);
	});
</script>

<div class="flex w-full flex-col items-center gap-4">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>เช็คอิน: {hits}</span>
		<span>{(remainingMs / 1000).toFixed(1)}s</span>
	</div>
	<div
		class="relative h-[min(60vh,420px)] w-full max-w-xs overflow-hidden rounded-[2rem] border-2 border-black bg-[#f3f2fb]"
	>
		{#each items as item (item.id)}
			<button
				type="button"
				onclick={() => slice(item)}
				class="falling-item absolute top-0 grid size-12 place-items-center rounded-2xl text-2xl shadow-[2px_2px_0_#111827] {item.isBomb
					? 'bg-black text-white'
					: 'bg-[#bde0fe]'}"
				style="left: {item.x}%; animation-duration: {item.fallMs}ms;"
			>
				{item.isBomb ? '💣' : '🧳'}
			</button>
		{/each}
	</div>
</div>

<style>
	.falling-item {
		animation-name: item-fall;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}

	@keyframes item-fall {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(480px);
		}
	}
</style>
