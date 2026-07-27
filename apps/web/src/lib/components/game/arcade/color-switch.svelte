<script lang="ts">
	// A four-color wheel spins continuously; tap the instant the color
	// matching this gate's target sits under the marker at the top. Ramp:
	// spin speed increases with every gate passed, so early gates are lazy
	// and later ones demand a split-second tap. rawScore = gates passed -
	// reported once at game-over via onGameOver, on a wrong-color tap or on
	// hitting the overall duration cap (see plan/arcade.ts).
	const COLORS = [
		{ key: 'red', bg: '#ff7a59' },
		{ key: 'blue', bg: '#56cfe1' },
		{ key: 'yellow', bg: '#fdf886' },
		{ key: 'green', bg: '#c7f9cc' }
	];
	const SPEED_START_DEG_S = 70;
	const SPEED_MAX_DEG_S = 260;
	const SPEED_RAMP_GATES = 15;

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	let angle = $state(0);
	let gatesPassed = $state(0);
	let targetIndex = $state(Math.floor(Math.random() * COLORS.length));
	let remainingMs = $state(durationMs);
	let flash = $state<'ok' | 'miss' | null>(null);
	let ended = false;

	let rafId = 0;
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	let lastFrameAt = 0;
	const startedAt = Date.now();

	function speedForGates(gates: number) {
		const t = Math.min(1, gates / SPEED_RAMP_GATES);
		return SPEED_START_DEG_S + t * (SPEED_MAX_DEG_S - SPEED_START_DEG_S);
	}

	function quadrantAtMarker(currentAngle: number) {
		const normalized = (((360 - (currentAngle % 360)) % 360) + 360) % 360;
		return Math.floor(normalized / 90) % COLORS.length;
	}

	function frame(now: number) {
		if (ended) return;
		if (!lastFrameAt) lastFrameAt = now;
		const dt = (now - lastFrameAt) / 1000;
		lastFrameAt = now;
		angle = (angle + speedForGates(gatesPassed) * dt) % 360;
		rafId = requestAnimationFrame(frame);
	}

	function endRound() {
		if (ended) return;
		ended = true;
		cancelAnimationFrame(rafId);
		clearInterval(tickIntervalId);
		onGameOver(gatesPassed);
	}

	function tap() {
		if (ended) return;
		const atMarker = quadrantAtMarker(angle);
		if (atMarker === targetIndex) {
			flash = 'ok';
			setTimeout(() => (flash = null), 150);
			gatesPassed += 1;
			targetIndex = Math.floor(Math.random() * COLORS.length);
		} else {
			flash = 'miss';
			endRound();
		}
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

<div class="flex w-full flex-col items-center gap-5">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>ผ่านด่าน: {gatesPassed}</span>
		<span>{(remainingMs / 1000).toFixed(0)}s</span>
	</div>
	<p class="text-sm font-medium text-[#62748e]">
		แตะตอนสี
		<span class="font-black" style="color: {COLORS[targetIndex]!.bg}">■</span>
		อยู่ตรงหมุด
	</p>
	<div class="relative mx-auto size-56">
		<div
			class="absolute inset-0 overflow-hidden rounded-full border-4 border-black"
			style="transform: rotate({angle}deg);"
		>
			{#each COLORS as color, i (i)}
				<div
					class="absolute top-1/2 left-1/2 h-1/2 w-1/2 origin-top-left"
					style="background: {color.bg}; transform: rotate({i * 90}deg);"
				></div>
			{/each}
		</div>
		<div
			class="absolute top-0 left-1/2 h-6 w-1 -translate-x-1/2 rounded-full bg-black {flash === 'ok'
				? 'ring-4 ring-[#c7f9cc]'
				: flash === 'miss'
					? 'ring-4 ring-red-500'
					: ''}"
		></div>
	</div>
	<button
		type="button"
		onclick={tap}
		class="rounded-full border-2 border-black bg-[#fdf886] px-6 py-3 font-black shadow-[3px_3px_0_#111827] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
	>
		แตะ!
	</button>
</div>
