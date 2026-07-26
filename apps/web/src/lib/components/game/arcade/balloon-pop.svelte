<script lang="ts">
	// Balloons spawn at the bottom and float upward; tap before they escape
	// off the top. Ramp over the round: spawn faster and float faster, so
	// early balloons are lazy and late ones rush past. rawScore = pops -
	// reported once at game-over via onGameOver (see plan/arcade.ts).
	const SPAWN_INTERVAL_START_MS = 900;
	const SPAWN_INTERVAL_END_MS = 350;
	const FLOAT_DURATION_START_MS = 3_200;
	const FLOAT_DURATION_END_MS = 1_600;
	const COLORS = ['#ff7a59', '#56cfe1', '#fdf886', '#c7f9cc', '#ffd6e8'];

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	type Balloon = { id: number; x: number; color: string; durationMs: number };

	let hits = $state(0);
	let balloons = $state<Balloon[]>([]);
	let remainingMs = $state(durationMs);
	let ended = $state(false);

	let nextId = 0;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	let lastSpawnAt = 0;
	const startedAt = Date.now();

	function pop(id: number) {
		if (ended) return;
		const before = balloons.length;
		balloons = balloons.filter((b) => b.id !== id);
		if (balloons.length < before) hits += 1;
	}

	function despawn(id: number) {
		balloons = balloons.filter((b) => b.id !== id);
	}

	function endRound() {
		if (ended) return;
		ended = true;
		balloons = [];
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
			const floatDuration =
				FLOAT_DURATION_START_MS - progress * (FLOAT_DURATION_START_MS - FLOAT_DURATION_END_MS);

			if (elapsed - lastSpawnAt >= spawnInterval) {
				lastSpawnAt = elapsed;
				const id = nextId++;
				balloons = [
					...balloons,
					{
						id,
						x: 8 + Math.random() * 84,
						color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
						durationMs: floatDuration
					}
				];
				setTimeout(() => despawn(id), floatDuration);
			}
		}, 100);

		return () => clearInterval(tickIntervalId);
	});
</script>

<div class="flex w-full flex-col items-center gap-4">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>แตะแล้ว: {hits}</span>
		<span>{(remainingMs / 1000).toFixed(1)}s</span>
	</div>
	<div
		class="relative h-[min(60vh,420px)] w-full max-w-xs overflow-hidden rounded-[2rem] border-2 border-black bg-[#eef2ff]"
	>
		{#each balloons as balloon (balloon.id)}
			<button
				type="button"
				onclick={() => pop(balloon.id)}
				class="balloon absolute bottom-0 grid size-12 place-items-center rounded-full text-2xl shadow-[2px_2px_0_#111827]"
				style="left: {balloon.x}%; background: {balloon.color}; animation-duration: {balloon.durationMs}ms;"
			>
				🎈
			</button>
		{/each}
	</div>
</div>

<style>
	.balloon {
		animation-name: balloon-float;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}

	@keyframes balloon-float {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-480px);
		}
	}
</style>
