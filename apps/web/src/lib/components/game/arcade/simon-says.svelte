<script lang="ts">
	import { untrack } from 'svelte';

	// Classic Simon: the game flashes a growing color sequence, player repeats
	// it back. Difficulty ramps by construction (longer sequence each round)
	// plus the flash/gap speed shrinks as the sequence grows, so late rounds
	// are both longer to remember and faster to watch. rawScore = number of
	// rounds fully recalled before the first mistake - reported once at
	// game-over via onGameOver (see plan/arcade.ts). Also bails out on the
	// overall duration cap as a safety net (a perfect player could otherwise
	// run indefinitely).
	const COLORS = [
		{ bg: '#ff7a59', label: 'แดง' },
		{ bg: '#56cfe1', label: 'ฟ้า' },
		{ bg: '#fdf886', label: 'เหลือง' },
		{ bg: '#c7f9cc', label: 'เขียว' }
	];
	const FLASH_MS_START = 600;
	const FLASH_MS_MIN = 260;
	const GAP_MS_START = 300;
	const GAP_MS_MIN = 130;
	const RAMP_ROUNDS = 12; // sequence length at which flash/gap speed bottoms out

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	type Phase = 'showing' | 'input' | 'over';

	let sequence = $state<number[]>([]);
	let phase = $state<Phase>('showing');
	let playerIndex = $state(0);
	let flashIndex = $state(-1);
	let tapFlash = $state(-1);
	let completedRounds = $state(0);
	let remainingMs = $state(durationMs);

	let ended = false;
	let showTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let tapTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	const startedAt = Date.now();

	function speedFor(length: number) {
		const t = Math.min(1, length / RAMP_ROUNDS);
		return {
			flashMs: FLASH_MS_START - t * (FLASH_MS_START - FLASH_MS_MIN),
			gapMs: GAP_MS_START - t * (GAP_MS_START - GAP_MS_MIN)
		};
	}

	function endRound() {
		if (ended) return;
		ended = true;
		phase = 'over';
		clearTimeout(showTimeoutId);
		clearTimeout(tapTimeoutId);
		clearInterval(tickIntervalId);
		onGameOver(completedRounds);
	}

	function playSequence() {
		phase = 'showing';
		flashIndex = -1;
		const { flashMs, gapMs } = speedFor(sequence.length);
		let step = 0;
		function next() {
			if (ended) return;
			if (step >= sequence.length) {
				flashIndex = -1;
				phase = 'input';
				playerIndex = 0;
				return;
			}
			flashIndex = sequence[step]!;
			showTimeoutId = setTimeout(() => {
				flashIndex = -1;
				showTimeoutId = setTimeout(() => {
					step += 1;
					next();
				}, gapMs);
			}, flashMs);
		}
		next();
	}

	function startNextRound() {
		sequence = [...sequence, Math.floor(Math.random() * COLORS.length)];
		playSequence();
	}

	function tapColor(color: number) {
		if (phase !== 'input' || ended) return;
		tapFlash = color;
		clearTimeout(tapTimeoutId);
		tapTimeoutId = setTimeout(() => (tapFlash = -1), 180);

		if (color !== sequence[playerIndex]) {
			endRound();
			return;
		}
		playerIndex += 1;
		if (playerIndex === sequence.length) {
			completedRounds = sequence.length;
			setTimeout(() => {
				if (!ended) startNextRound();
			}, 500);
		}
	}

	$effect(() => {
		// untrack: startNextRound synchronously reads/writes `sequence` -
		// without this, that read registers as a dependency of this effect,
		// so every later write to `sequence` (every round, forever) reruns
		// the whole effect and restarts the round from scratch. Same trap in
		// flappy-runner.svelte and slingshot-toss.svelte, fixed the same way.
		untrack(() => startNextRound());
		tickIntervalId = setInterval(() => {
			remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
			if (remainingMs <= 0) endRound();
		}, 200);

		return () => {
			clearTimeout(showTimeoutId);
			clearTimeout(tapTimeoutId);
			clearInterval(tickIntervalId);
		};
	});
</script>

<div class="flex w-full flex-col items-center gap-5">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>รอบที่จำได้: {completedRounds}</span>
		<span>{(remainingMs / 1000).toFixed(0)}s</span>
	</div>
	<p class="text-sm font-medium text-[#62748e]">
		{phase === 'showing' ? 'ดูลำดับให้ดี...' : 'แตะตามลำดับ'}
	</p>
	<div class="grid w-full max-w-xs grid-cols-2 gap-3">
		{#each COLORS as color, index (index)}
			<button
				type="button"
				disabled={phase !== 'input'}
				onclick={() => tapColor(index)}
				class="aspect-square rounded-2xl border-2 border-black shadow-[3px_3px_0_#111827] transition-opacity"
				style="background: {color.bg}; opacity: {flashIndex === index || tapFlash === index
					? 1
					: 0.55};"
				aria-label={color.label}
			></button>
		{/each}
	</div>
</div>
