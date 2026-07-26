<script lang="ts">
	// One arithmetic problem falls at a time; type its two-digit answer on the
	// keypad - it auto-checks the instant a second digit is entered. Wrong
	// guesses cost nothing and don't stop the fall (just clears the keypad for
	// another try); the only way to lose a heart is letting a problem hit the
	// floor unanswered. 3 hearts, game ends at 0. Ramp over the round: harder
	// operand ranges/operator mix (tier by correct-answer count) and a
	// shrinking fall time, so early problems are slow 2-number sums and later
	// ones are fast 3-number mixes. rawScore = correct answers - reported once
	// at game-over via onGameOver, on 0 hearts or on hitting the overall
	// duration cap (a safety net - see plan/arcade.ts).
	const START_HEARTS = 3;
	const FALL_MS_START = 4_600;
	const FALL_MS_MIN = 1_900;
	const FALL_MS_STEP = 140;

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	type Problem = { id: number; expr: string; value: number; fallMs: number };

	function randInt(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function tierFor(correct: number) {
		if (correct < 5) return 0;
		if (correct < 12) return 1;
		return 2;
	}

	function fallMsFor(correct: number) {
		return Math.max(FALL_MS_MIN, FALL_MS_START - correct * FALL_MS_STEP);
	}

	function generateProblem(correct: number): { expr: string; value: number } {
		const tier = tierFor(correct);
		for (let tries = 0; tries < 60; tries += 1) {
			if (tier < 2) {
				const a = randInt(tier === 0 ? 5 : 8, tier === 0 ? 45 : 70);
				const b = randInt(tier === 0 ? 5 : 8, tier === 0 ? 45 : 60);
				const subtract = tier === 1 && Math.random() < 0.5;
				if (subtract) {
					const hi = Math.max(a, b);
					const lo = Math.min(a, b);
					const value = hi - lo;
					if (value >= 10 && value <= 99) return { expr: `${hi} - ${lo}`, value };
				} else {
					const value = a + b;
					if (value >= 10 && value <= 99) return { expr: `${a} + ${b}`, value };
				}
			} else {
				const a = randInt(10, 60);
				const b = randInt(1, 25);
				const c = randInt(1, 25);
				const pattern = randInt(0, 2);
				const [expr, value] =
					pattern === 0
						? [`${a} + ${b} - ${c}`, a + b - c]
						: pattern === 1
							? [`${a} - ${b} + ${c}`, a - b + c]
							: [`${a} - ${b} - ${c}`, a - b - c];
				if (typeof value === 'number' && value >= 10 && value <= 99) {
					return { expr: expr as string, value };
				}
			}
		}
		const a = randInt(20, 70);
		const b = randInt(1, 9);
		return { expr: `${a} + ${b}`, value: a + b };
	}

	let hearts = $state(START_HEARTS);
	let correct = $state(0);
	let problem = $state<Problem | null>(null);
	let answerBuffer = $state('');
	let shake = $state(false);
	let remainingMs = $state(durationMs);
	let ended = false;

	let nextId = 0;
	let floorTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	const startedAt = Date.now();

	function spawnProblem() {
		const { expr, value } = generateProblem(correct);
		const fallMs = fallMsFor(correct);
		const id = nextId++;
		problem = { id, expr, value, fallMs };
		floorTimeoutId = setTimeout(() => onFloorHit(id), fallMs);
	}

	function onFloorHit(id: number) {
		if (ended || !problem || problem.id !== id) return;
		hearts -= 1;
		answerBuffer = '';
		if (hearts <= 0) {
			endRound();
			return;
		}
		spawnProblem();
	}

	function endRound() {
		if (ended) return;
		ended = true;
		clearTimeout(floorTimeoutId);
		clearInterval(tickIntervalId);
		onGameOver(correct);
	}

	function tapDigit(digit: number) {
		if (ended || !problem) return;
		answerBuffer += String(digit);
		if (answerBuffer.length < 2) return;

		if (Number(answerBuffer) === problem.value) {
			correct += 1;
			clearTimeout(floorTimeoutId);
			answerBuffer = '';
			spawnProblem();
		} else {
			shake = true;
			setTimeout(() => (shake = false), 200);
			answerBuffer = '';
		}
	}

	$effect(() => {
		spawnProblem();
		tickIntervalId = setInterval(() => {
			remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
			if (remainingMs <= 0) endRound();
		}, 200);

		return () => {
			clearTimeout(floorTimeoutId);
			clearInterval(tickIntervalId);
		};
	});
</script>

<div class="flex w-full flex-col items-center gap-4">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>ตอบถูก: {correct}</span>
		<span class="text-lg">
			{#each Array(START_HEARTS) as _, i (i)}
				{i < hearts ? '❤️' : '🤍'}
			{/each}
		</span>
	</div>

	<div
		class="relative h-40 w-full max-w-xs overflow-hidden rounded-2xl border-2 border-black bg-[#f3f2fb]"
	>
		{#if problem}
			{#key problem.id}
				<div
					class="falling-problem absolute left-1/2 -translate-x-1/2 rounded-2xl border-2 border-black bg-white px-4 py-2 text-xl font-black shadow-[3px_3px_0_#111827]"
					style="animation-duration: {problem.fallMs}ms;"
				>
					{problem.expr}
				</div>
			{/key}
		{/if}
		<div class="absolute right-0 bottom-0 left-0 h-1.5 bg-black/70"></div>
	</div>

	<p class="h-8 text-2xl font-black tracking-[0.3em] tabular-nums" class:answer-shake={shake}>
		{answerBuffer.padEnd(2, '_')}
	</p>

	<div class="grid w-full max-w-xs grid-cols-5 gap-2">
		{#each Array(10) as _, digit (digit)}
			<button
				type="button"
				onclick={() => tapDigit(digit)}
				disabled={ended}
				class="rounded-xl border-2 border-black bg-[#bde0fe] py-3 text-lg font-black shadow-[2px_2px_0_#111827] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
			>
				{digit}
			</button>
		{/each}
	</div>
</div>

<style>
	.falling-problem {
		animation-name: problem-fall;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
		top: 0;
	}

	@keyframes problem-fall {
		from {
			transform: translate(-50%, 0);
		}
		to {
			transform: translate(-50%, 140px);
		}
	}

	.answer-shake {
		animation: shake-x 0.2s ease-in-out;
	}

	@keyframes shake-x {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(-6px);
		}
		75% {
			transform: translateX(6px);
		}
	}
</style>
