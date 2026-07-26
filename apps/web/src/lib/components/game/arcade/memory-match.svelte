<script lang="ts">
	// Flip two cards at a time to find matching pairs. Ramp over the round:
	// unmatched, face-down cards get reshuffled to new positions on a timer
	// that fires more often as time passes, so memorized positions decay
	// faster later in the round. rawScore (0-100) rewards finishing fast with
	// few wrong attempts; reported once at game-over via onGameOver (see
	// plan/arcade.ts) - either on completing all pairs or on hitting the
	// overall duration cap.
	const SYMBOLS = ['✈️', '🧳', '🎫', '🌤️', '🎈', '🗺️'];
	const RESHUFFLE_START_MS = 9_000;
	const RESHUFFLE_MIN_MS = 3_500;

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	type Card = { id: number; symbol: string; matched: boolean };

	function shuffledDeck(): Card[] {
		const deck = SYMBOLS.flatMap((symbol, index) => [
			{ id: index * 2, symbol, matched: false },
			{ id: index * 2 + 1, symbol, matched: false }
		]);
		for (let i = deck.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j]!, deck[i]!];
		}
		return deck;
	}

	let cards = $state(shuffledDeck());
	let flipped = $state<number[]>([]);
	let wrongAttempts = $state(0);
	let matchedPairs = $state(0);
	let remainingMs = $state(durationMs);
	let busy = $state(false);

	let ended = false;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	let lastReshuffleAt = 0;
	const startedAt = Date.now();
	const totalPairs = SYMBOLS.length;

	function reshuffleUnmatched() {
		const unmatchedIndexes = cards
			.map((c, i) => i)
			.filter((i) => !cards[i]!.matched && !flipped.includes(i));
		const shuffledPositions = [...unmatchedIndexes].sort(() => Math.random() - 0.5);
		const next = [...cards];
		unmatchedIndexes.forEach((slot, k) => {
			next[slot] = cards[shuffledPositions[k]!]!;
		});
		cards = next;
	}

	function flip(index: number) {
		if (ended || busy) return;
		if (cards[index]!.matched || flipped.includes(index)) return;
		if (flipped.length === 2) return;

		flipped = [...flipped, index];
		if (flipped.length === 2) {
			busy = true;
			const [a, b] = flipped;
			if (cards[a!]!.symbol === cards[b!]!.symbol) {
				cards = cards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
				matchedPairs += 1;
				flipped = [];
				busy = false;
				if (matchedPairs === totalPairs) finish();
			} else {
				wrongAttempts += 1;
				setTimeout(() => {
					flipped = [];
					busy = false;
				}, 700);
			}
		}
	}

	function finish() {
		if (ended) return;
		ended = true;
		clearInterval(tickIntervalId);
		const elapsedSec = (Date.now() - startedAt) / 1000;
		const score = Math.round(Math.max(0, 100 - wrongAttempts * 6 - elapsedSec / 2));
		onGameOver(score);
	}

	function timeUp() {
		if (ended) return;
		ended = true;
		clearInterval(tickIntervalId);
		const partial = Math.round(Math.max(0, (matchedPairs / totalPairs) * 70 - wrongAttempts * 4));
		onGameOver(partial);
	}

	$effect(() => {
		tickIntervalId = setInterval(() => {
			const elapsed = Date.now() - startedAt;
			remainingMs = Math.max(0, durationMs - elapsed);
			if (remainingMs <= 0) {
				timeUp();
				return;
			}

			const progress = Math.min(1, elapsed / durationMs);
			const reshuffleInterval =
				RESHUFFLE_START_MS - progress * (RESHUFFLE_START_MS - RESHUFFLE_MIN_MS);
			if (!busy && elapsed - lastReshuffleAt >= reshuffleInterval) {
				lastReshuffleAt = elapsed;
				reshuffleUnmatched();
			}
		}, 200);

		return () => clearInterval(tickIntervalId);
	});
</script>

<div class="flex w-full flex-col items-center gap-4">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>คู่ที่เจอ: {matchedPairs}/{totalPairs} · พลาด {wrongAttempts}</span>
		<span>{(remainingMs / 1000).toFixed(0)}s</span>
	</div>
	<div class="grid w-full max-w-xs grid-cols-4 gap-2">
		{#each cards as card, index (card.id)}
			<button
				type="button"
				onclick={() => flip(index)}
				class="aspect-square rounded-xl border-2 border-black text-2xl shadow-[2px_2px_0_#111827] transition-colors {card.matched
					? 'bg-[#c7f9cc]'
					: flipped.includes(index)
						? 'bg-white'
						: 'bg-[#101828]'}"
			>
				{card.matched || flipped.includes(index) ? card.symbol : ''}
			</button>
		{/each}
	</div>
</div>
