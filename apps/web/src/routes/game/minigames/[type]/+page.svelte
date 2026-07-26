<script lang="ts">
	import { apiClient, call, callWithTurnstile, ApiError } from '$lib/api';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner';
	import TurnstileWidget from '$lib/components/turnstile-widget.svelte';
	import CrystalBall from '$lib/assets/game/crystal-ball.png';
	import House from '@lucide/svelte/icons/house';
	import Package from '@lucide/svelte/icons/package';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import NumberFlow from '@number-flow/svelte';
	import confetti from 'canvas-confetti';
	import { WHEEL_OUTCOMES } from '@vidyafreshmen/dto';

	let { data } = $props();
	const client = apiClient();
	const gameType = $derived(data.gameType);

	// Separate widget instance from game-on.svelte's - this is a different
	// route, so Svelte component state isn't shared across the navigation.
	// Gates puzzle/precision submit, wheel claim, mystery box open
	// (routers/minigame.ts's requireTurnstile) - most calls never actually
	// need a fresh solve since the server reuses a recent verification
	// (turnstile-gate.ts), so this widget usually sits invisible/idle.
	let turnstileWidget: TurnstileWidget | undefined = $state();
	const takeTurnstileToken = () => turnstileWidget?.takeToken() ?? Promise.resolve(null);

	type GameResult = {
		title: string;
		detail?: string;
		points?: number;
		badge?: string;
	};

	let submitting = $state(false);
	let result = $state<GameResult | null>(null);

	function newPlayToken() {
		return crypto.randomUUID();
	}

	function getOrCreatePlayToken(type: string) {
		const key = `minigame:${type}:play-token`;
		const existing = sessionStorage.getItem(key);
		if (existing) return existing;
		const token = newPlayToken();
		sessionStorage.setItem(key, token);
		return token;
	}

	function clearPlayToken(type: string) {
		sessionStorage.removeItem(`minigame:${type}:play-token`);
	}

	function errorMessage(error: unknown, fallback: string) {
		return error instanceof ApiError ? error.message : fallback;
	}

	function celebrate() {
		confetti({
			particleCount: 120,
			spread: 78,
			origin: { y: 0.62 },
			colors: ['#fdf886', '#ff7a59', '#56cfe1', '#111827']
		});
	}

	function applyChanceResult(reward: {
		outcome: string;
		points: number;
		rewardKind: 'points' | 'buff' | 'none';
		multiplier?: number;
		durationMs?: number;
		convertedFromBuff?: boolean;
	}) {
		clearPlayToken(gameType);
		if (reward.rewardKind === 'buff') {
			celebrate();
			result = {
				title: `บูสต์ x${reward.multiplier} พร้อมใช้!`,
				detail: `เริ่มนับเวลาตอนรับรางวัล ไม่เสียเวลาระหว่างแอนิเมชัน`,
				badge: `x${reward.multiplier} BOOST`
			};
			return;
		}
		if (reward.points > 0) celebrate();
		result = {
			title:
				reward.outcome === 'skull'
					? 'รอบนี้ยังไม่ใช่ของเรา'
					: reward.convertedFromBuff
						? 'มีบูสต์อยู่แล้ว—แปลงเป็นแต้มให้!'
						: 'รับแต้มสำเร็จ',
			detail: reward.convertedFromBuff ? 'รางวัลบูสต์ไม่สูญเปล่า' : undefined,
			points: reward.points
		};
	}

	// --- alignment puzzle ---
	let puzzleStarted = $state(false);
	let puzzlePlayToken = $state('');
	let range = $state(50);
	let targetX = $state(0);
	let targetY = $state(0);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let dragging = $state(false);
	const puzzleDistance = $derived(Math.hypot(offsetX - targetX, offsetY - targetY));
	const puzzleCloseness = $derived(Math.max(0, 1 - puzzleDistance / (Math.sqrt(2) * range)));

	async function startPuzzle() {
		if (submitting) return;
		submitting = true;
		puzzlePlayToken ||= getOrCreatePlayToken('puzzle');
		try {
			const response = await call(
				client.minigame.puzzle.start.$post({ json: { playToken: puzzlePlayToken } })
			);
			range = response.range;
			targetX = response.targetX;
			targetY = response.targetY;
			puzzleStarted = true;
		} catch (error) {
			toast.error(errorMessage(error, 'เริ่มเกมจัดแนวไม่สำเร็จ'));
		} finally {
			submitting = false;
		}
	}

	function onPointerDown(event: PointerEvent) {
		dragging = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging) return;
		offsetX = Math.max(-range, Math.min(range, offsetX + event.movementX));
		offsetY = Math.max(-range, Math.min(range, offsetY + event.movementY));
	}

	function onPointerUp(event: PointerEvent) {
		dragging = false;
		const target = event.currentTarget as HTMLElement;
		if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
	}

	async function submitPuzzle() {
		if (submitting) return;
		submitting = true;
		try {
			const response = await callWithTurnstile(
				(turnstileToken) =>
					client.minigame.puzzle.submit.$post({
						json: { playToken: puzzlePlayToken, x: offsetX, y: offsetY },
						query: { turnstileToken }
					}),
				takeTurnstileToken
			);
			if (response.points > 0) celebrate();
			result = {
				title: `ตรงกัน ${response.accuracy.toFixed(1)}%`,
				detail:
					response.accuracy >= 90 ? 'จัดแนวได้เฉียบมาก!' : 'ยิ่งซ้อนเงาได้พอดี ยิ่งได้แต้มสูง',
				points: response.points
			};
			clearPlayToken('puzzle');
		} catch (error) {
			toast.error(errorMessage(error, 'ส่งผลเกมไม่สำเร็จ กดอีกครั้งเพื่อรับผลเดิมได้'));
		} finally {
			submitting = false;
		}
	}

	// --- rhythm precision ---
	type RhythmPhase = 'idle' | 'count-in' | 'playing' | 'finished';
	let rhythmPhase = $state<RhythmPhase>('idle');
	let rhythmPlayToken = $state('');
	let bpm = $state(120);
	let beatIntervalMs = $state(500);
	let countInBeats = $state(4);
	let scoringBeats = $state(8);
	let rhythmStartPerf = 0;
	let rhythmRafId = 0;
	let currentBeat = $state(0);
	let rhythmPulse = $state(0);
	let scoredBeat = $state(0);
	let tapOffsetsMs = $state<number[]>([]);
	let lastJudgement = $state('');
	let audioContext: AudioContext | null = null;

	function scheduleClick(context: AudioContext, at: number, accent: boolean) {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.type = accent ? 'triangle' : 'sine';
		oscillator.frequency.setValueAtTime(accent ? 1046 : 740, at);
		gain.gain.setValueAtTime(0.0001, at);
		gain.gain.exponentialRampToValueAtTime(accent ? 0.28 : 0.16, at + 0.006);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start(at);
		oscillator.stop(at + 0.1);
	}

	function stopMetronome() {
		cancelAnimationFrame(rhythmRafId);
		audioContext?.close().catch(() => undefined);
		audioContext = null;
	}

	async function submitRhythm(clientDurationMs: number) {
		if (submitting) return;
		submitting = true;
		rhythmPhase = 'finished';
		try {
			const response = await callWithTurnstile(
				(turnstileToken) =>
					client.minigame.precision.submit.$post({
						json: {
							playToken: rhythmPlayToken,
							tapOffsetsMs: [...tapOffsetsMs],
							clientDurationMs
						},
						query: { turnstileToken }
					}),
				takeTurnstileToken
			);
			if (response.points > 0) celebrate();
			result = {
				title: `${response.perfect} PERFECT · ${response.great} GREAT`,
				detail: `คลาดเฉลี่ย ${response.averageOffsetMs.toFixed(0)} ms · พลาด ${response.misses} จังหวะ`,
				points: response.points
			};
			clearPlayToken('precision');
		} catch (error) {
			toast.error(errorMessage(error, 'ส่งจังหวะไม่สำเร็จ ลองรับผลอีกครั้ง'));
		} finally {
			submitting = false;
		}
	}

	function rhythmTick() {
		const elapsed = performance.now() - rhythmStartPerf;
		const safeElapsed = Math.max(0, elapsed);
		const beatFloat = safeElapsed / beatIntervalMs;
		currentBeat = Math.floor(beatFloat);
		rhythmPulse = 1 - (beatFloat - Math.floor(beatFloat));

		if (elapsed < countInBeats * beatIntervalMs) {
			rhythmPhase = 'count-in';
		} else {
			rhythmPhase = 'playing';
			scoredBeat = Math.min(scoringBeats, currentBeat - countInBeats + 1);
		}

		const totalDuration = (countInBeats + scoringBeats) * beatIntervalMs;
		if (elapsed >= totalDuration) {
			stopMetronome();
			void submitRhythm(elapsed);
			return;
		}
		rhythmRafId = requestAnimationFrame(rhythmTick);
	}

	async function runMetronome() {
		stopMetronome();
		tapOffsetsMs = [];
		lastJudgement = '';
		scoredBeat = 0;

		audioContext = new AudioContext();
		await audioContext.resume();
		const leadInMs = 650;
		const audioStart = audioContext.currentTime + leadInMs / 1000;
		rhythmStartPerf = performance.now() + leadInMs;
		const totalBeats = countInBeats + scoringBeats;
		for (let index = 0; index < totalBeats; index += 1) {
			scheduleClick(
				audioContext,
				audioStart + (index * beatIntervalMs) / 1000,
				index === countInBeats
			);
		}
		rhythmPhase = 'count-in';
		rhythmRafId = requestAnimationFrame(rhythmTick);
	}

	async function startRhythm() {
		if (submitting) return;
		submitting = true;
		rhythmPlayToken ||= getOrCreatePlayToken('precision');
		try {
			const response = await call(
				client.minigame.precision.start.$post({ json: { playToken: rhythmPlayToken } })
			);
			bpm = response.bpm;
			beatIntervalMs = response.beatIntervalMs;
			countInBeats = response.countInBeats;
			scoringBeats = response.scoringBeats;
			submitting = false;
			await runMetronome();
		} catch (error) {
			toast.error(errorMessage(error, 'เริ่มเกมจังหวะไม่สำเร็จ'));
			submitting = false;
		}
	}

	function tapBeat() {
		if (rhythmPhase !== 'playing') return;
		const elapsed = performance.now() - rhythmStartPerf;
		tapOffsetsMs.push(elapsed);
		const firstTarget = countInBeats * beatIntervalMs;
		const nearest = Math.round((elapsed - firstTarget) / beatIntervalMs);
		const target = firstTarget + nearest * beatIntervalMs;
		const difference = Math.abs(elapsed - target);
		lastJudgement =
			difference <= 50
				? 'PERFECT'
				: difference <= 100
					? 'GREAT'
					: difference <= 180
						? 'GOOD'
						: 'MISS';
		navigator.vibrate?.(18);
	}

	async function retryRhythmResult() {
		await submitRhythm((countInBeats + scoringBeats) * beatIntervalMs);
	}

	// --- wheel ---
	let wheelCumulative = 0;
	const wheelSlices = WHEEL_OUTCOMES.map((slice) => {
		const startAngle = wheelCumulative * 3.6;
		wheelCumulative += slice.weight;
		const endAngle = wheelCumulative * 3.6;
		return { ...slice, startAngle, endAngle, midAngle: (startAngle + endAngle) / 2 };
	});
	const wheelConicGradient = wheelSlices
		.map((slice) => `${slice.color} ${slice.startAngle}deg ${slice.endAngle}deg`)
		.join(', ');
	const WHEEL_SPIN_MS = 4200;
	let wheelRotation = $state(0);
	let wheelSpinning = $state(false);
	let wheelPlayToken = $state('');
	let wheelAwaitingClaim = $state(false);

	async function claimWheelReward() {
		if (submitting || !wheelPlayToken) return;
		submitting = true;
		try {
			const reward = await callWithTurnstile(
				(turnstileToken) =>
					client.minigame.wheel.claim.$post({
						json: { playToken: wheelPlayToken },
						query: { turnstileToken }
					}),
				takeTurnstileToken
			);
			wheelAwaitingClaim = false;
			applyChanceResult(reward);
		} catch (error) {
			wheelAwaitingClaim = true;
			toast.error(errorMessage(error, 'รับรางวัลไม่สำเร็จ กดรับรางวัลอีกครั้งได้'));
		} finally {
			submitting = false;
		}
	}

	async function playWheel() {
		if (submitting || wheelSpinning) return;
		submitting = true;
		wheelPlayToken ||= getOrCreatePlayToken('wheel');
		try {
			const response = await call(
				client.minigame.wheel.play.$post({ json: { playToken: wheelPlayToken } })
			);
			const slice = wheelSlices.find((candidate) => candidate.key === response.outcome);
			const targetWithinTurn = slice ? (360 - slice.midAngle) % 360 : 0;
			wheelSpinning = true;
			wheelRotation = 6 * 360 + targetWithinTurn;
			await new Promise((resolve) => setTimeout(resolve, WHEEL_SPIN_MS + 150));
			wheelSpinning = false;
			wheelAwaitingClaim = true;
			submitting = false;
			await claimWheelReward();
		} catch (error) {
			wheelSpinning = false;
			toast.error(errorMessage(error, 'หมุนวงล้อไม่สำเร็จ'));
			submitting = false;
		}
	}

	// --- mystery box ---
	let boxShaking = $state(false);
	let mysteryPlayToken = $state('');
	let mysteryRemaining = $state<number | null>(null);

	async function loadMysteryStatus() {
		try {
			const status = await call(client.minigame.mystery_box.status.$get());
			mysteryRemaining = status.remaining;
		} catch {
			mysteryRemaining = null;
		}
	}

	async function openMysteryBox() {
		if (submitting || boxShaking) return;
		submitting = true;
		boxShaking = true;
		mysteryPlayToken ||= getOrCreatePlayToken('mystery_box');
		try {
			// Reveal animation runs before the request, so a time-limited buff
			// begins only when the player can actually use it.
			await new Promise((resolve) => setTimeout(resolve, 900));
			const reward = await callWithTurnstile(
				(turnstileToken) =>
					client.minigame.mystery_box.open.$post({
						json: { playToken: mysteryPlayToken },
						query: { turnstileToken }
					}),
				takeTurnstileToken
			);
			applyChanceResult(reward);
		} catch (error) {
			toast.error(errorMessage(error, 'เปิดกล่องไม่สำเร็จ'));
		} finally {
			boxShaking = false;
			submitting = false;
		}
	}

	function handleVisibilityChange() {
		if (document.hidden && (rhythmPhase === 'count-in' || rhythmPhase === 'playing')) {
			stopMetronome();
			rhythmPhase = 'idle';
			tapOffsetsMs = [];
			toast.info('เกมจังหวะหยุดไว้ กดเริ่มใหม่ได้โดยไม่เสียตั๋วเพิ่ม');
		}
	}

	onMount(() => {
		document.addEventListener('visibilitychange', handleVisibilityChange);
		if (gameType === 'mystery_box') void loadMysteryStatus();
	});

	onDestroy(() => {
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		stopMetronome();
	});
</script>

<Toaster />
<svelte:head>
	<title>มินิเกม · ศึกเขย่าลูกแก้ว</title>
</svelte:head>

<!-- Interactive challenges (rare) render here so the player can tap them;
     the usual managed pass is invisible. -->
<TurnstileWidget bind:this={turnstileWidget} />

<div class="min-h-screen w-full bg-[#f3f2fb] text-[#101828]">
	<header class="mx-auto flex w-full max-w-md items-center gap-4 px-4 py-4">
		<a
			href="/game"
			class="grid size-10 place-items-center rounded-full bg-white shadow-sm"
			aria-label="กลับหน้าเกม"
		>
			<House class="size-5" />
		</a>
		<div class="flex-1 text-center">
			<p class="text-[11px] font-black tracking-[0.24em] text-[#9a6418] uppercase">
				Skybound arcade
			</p>
			<h1 class="text-xl font-black">
				{gameType === 'puzzle'
					? 'จัดแนวลูกแก้ว'
					: gameType === 'precision'
						? 'Beat Lock'
						: gameType === 'wheel'
							? 'Lucky Flight'
							: 'Daily Cargo'}
			</h1>
		</div>
		<div class="size-10"></div>
	</header>

	<main class="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-4 pb-10">
		{#if result}
			<section
				class="result-card mt-8 w-full overflow-hidden rounded-[2rem] border-2 border-black bg-white shadow-[8px_8px_0_#111827]"
			>
				<div
					class="h-3 bg-[repeating-linear-gradient(90deg,#fdf886_0_28px,#111827_28px_36px)]"
				></div>
				<div class="flex flex-col items-center gap-3 px-6 py-8 text-center">
					<p class="text-xs font-black tracking-[0.22em] text-[#9a6418] uppercase">
						Flight complete
					</p>
					<h2 class="text-2xl font-black">{result.title}</h2>
					{#if result.badge}
						<span
							class="rotate-[-2deg] border-2 border-[#ffc700] bg-black px-4 py-2 font-black tracking-widest text-[#ffc700]"
						>
							{result.badge}
						</span>
					{/if}
					{#if result.points !== undefined}
						<p class="mt-2 text-6xl font-black text-[#9a6418] tabular-nums">
							<NumberFlow value={result.points} />
						</p>
						<p class="-mt-2 text-sm font-bold text-[#62748e]">แต้ม</p>
					{/if}
					{#if result.detail}<p class="max-w-xs text-sm text-[#62748e]">{result.detail}</p>{/if}
					<a
						href="/game"
						class="mt-3 rounded-full border-2 border-black bg-[#fdf886] px-6 py-3 font-black shadow-[3px_3px_0_#111827] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
					>
						กลับไปเขย่าลูกแก้ว
					</a>
				</div>
			</section>
		{:else if gameType === 'puzzle'}
			{#if !puzzleStarted}
				<section class="intro-card">
					<div class="intro-icon">◎</div>
					<p class="eyebrow">ALIGNMENT TEST</p>
					<h2>ลากสัญลักษณ์ทึบ<br />ให้ซ้อนกับเงา</h2>
					<p>ตำแหน่งเป้าหมายมองเห็นได้จริง คะแนนขึ้นกับระยะห่างตอนกดยืนยัน</p>
					<button class="primary-button" disabled={submitting} onclick={startPuzzle}>
						{submitting ? 'กำลังเตรียม...' : 'ใช้ตั๋วและเริ่มเกม'}
					</button>
				</section>
			{:else}
				<div
					class="flex w-full items-center justify-between rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-black"
				>
					<span>ALIGN SIGNAL</span>
					<span>{Math.round(puzzleCloseness * 100)}% SYNC</span>
				</div>
				<div
					class="puzzle-arena relative size-[min(78vw,310px)] touch-none overflow-hidden rounded-[2rem] border-[3px] border-black select-none"
					style="--sync: {puzzleCloseness};"
					onpointerdown={onPointerDown}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
					onpointercancel={onPointerUp}
					role="application"
					aria-label="ลากลูกแก้วทึบให้ซ้อนกับเงาลูกแก้ว"
				>
					<div class="grid-lines pointer-events-none absolute inset-0"></div>
					<div
						class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25 grayscale"
						style="transform: translate({targetX}px, {targetY}px);"
						aria-hidden="true"
					>
						<img src={CrystalBall} alt="" class="size-28 object-contain" draggable="false" />
					</div>
					<div
						class="absolute inset-0 flex items-center justify-center drop-shadow-xl"
						style="transform: translate({offsetX}px, {offsetY}px) scale({dragging
							? 1.12
							: 1}); transition: {dragging ? 'none' : 'transform .12s ease-out'}; cursor: {dragging
							? 'grabbing'
							: 'grab'};"
						aria-hidden="true"
					>
						<img src={CrystalBall} alt="" class="size-28 object-contain" draggable="false" />
					</div>
				</div>
				<p class="text-center text-sm font-medium text-[#62748e]">
					เงาจางคือเป้าหมาย · ลากตัวทึบให้ซ้อนสนิท
				</p>
				<button class="primary-button" disabled={submitting} onclick={submitPuzzle}>
					{submitting ? 'กำลังตรวจ...' : 'ล็อกตำแหน่ง'}
				</button>
			{/if}
		{:else if gameType === 'precision'}
			{#if rhythmPhase === 'idle'}
				<section class="intro-card rhythm-intro">
					<div class="intro-icon"><Volume2 class="size-9" /></div>
					<p class="eyebrow">{bpm} BPM · 8 BEATS</p>
					<h2>ฟังจังหวะ<br />แล้วแตะให้ตรงบีต</h2>
					<p>
						นับเข้า 4 ครั้ง จากนั้นแตะทุกเสียงอีก 8 ครั้ง เสียง ภาพ
						และคะแนนใช้เวลาเดียวกันบนเครื่องนี้
					</p>
					<button class="primary-button" disabled={submitting} onclick={startRhythm}>
						{submitting
							? 'กำลังเตรียมเสียง...'
							: rhythmPlayToken
								? 'เริ่มจังหวะใหม่'
								: 'ใช้ตั๋วและเปิดเสียง'}
					</button>
				</section>
			{:else}
				<div
					class="flex w-full items-center justify-between rounded-full border-2 border-black bg-[#111827] px-4 py-2 text-xs font-black text-white"
				>
					<span>{rhythmPhase === 'count-in' ? 'COUNT IN' : 'TAP ON BEAT'}</span>
					<span
						>{rhythmPhase === 'count-in'
							? `${Math.max(1, countInBeats - currentBeat)}`
							: `${scoredBeat}/${scoringBeats}`}</span
					>
				</div>
				<button
					type="button"
					class="beat-deck relative grid size-[min(78vw,310px)] place-items-center overflow-hidden rounded-full border-[5px] border-black bg-[#111827] text-white shadow-[0_12px_0_#9a6418] active:translate-y-1 active:shadow-[0_8px_0_#9a6418]"
					class:tap-ready={rhythmPhase === 'playing'}
					onclick={tapBeat}
					disabled={rhythmPhase !== 'playing'}
					aria-label="แตะตามจังหวะ"
				>
					<span
						class="beat-ring absolute rounded-full border-[3px] border-[#fdf886]"
						style="transform: scale({0.58 + rhythmPulse * 0.38}); opacity: {0.25 +
							rhythmPulse * 0.7};"
					></span>
					<span
						class="beat-ring absolute rounded-full border border-white/40"
						style="transform: scale({0.35 + rhythmPulse * 0.62});"
					></span>
					<span class="relative z-10 text-center">
						<span class="block text-xs font-black tracking-[0.24em] text-[#fdf886]">
							{rhythmPhase === 'count-in' ? 'GET READY' : lastJudgement || 'TAP'}
						</span>
						<span class="block text-7xl font-black tabular-nums">
							{rhythmPhase === 'count-in' ? Math.max(1, countInBeats - currentBeat) : scoredBeat}
						</span>
					</span>
				</button>
				<div class="grid w-full grid-cols-8 gap-1.5" aria-label="จำนวนจังหวะ">
					{#each Array(scoringBeats) as _, index (index)}
						<div
							class="h-2.5 rounded-full border border-black {index < scoredBeat
								? 'bg-[#fdf886]'
								: 'bg-white'}"
						></div>
					{/each}
				</div>
				{#if rhythmPhase === 'finished' && !submitting}
					<button class="secondary-button" onclick={retryRhythmResult}>รับผลอีกครั้ง</button>
				{:else}
					<p class="text-center text-sm font-medium text-[#62748e]">
						{rhythmPhase === 'count-in'
							? 'ฟัง 4 จังหวะแรก ยังไม่ต้องแตะ'
							: 'แตะวงกลมทุกครั้งที่ได้ยินเสียง'}
					</p>
				{/if}
			{/if}
		{:else if gameType === 'wheel'}
			<p class="eyebrow mt-2">LUCKY DRAW · รางวัลสุ่ม</p>
			<div class="relative mx-auto size-[min(76vw,300px)] rounded-full shadow-[8px_10px_0_#9a6418]">
				<div class="absolute -top-5 left-1/2 z-20 -translate-x-1/2 text-4xl drop-shadow">▼</div>
				<div
					class="relative size-full rounded-full border-[7px] border-black"
					style="background: conic-gradient({wheelConicGradient}); transform: rotate({wheelRotation}deg); transition: transform {WHEEL_SPIN_MS}ms cubic-bezier(.12,.67,.1,.99);"
				>
					{#each wheelSlices as slice (slice.key)}
						<div
							class="absolute top-1/2 left-1/2 flex items-center justify-center text-base font-black text-black"
							style="transform: translate(-50%, -50%) rotate({slice.midAngle}deg) translateY(-108px);"
						>
							{slice.label}
						</div>
					{/each}
				</div>
				<div
					class="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-black bg-[#fdf886]"
				></div>
			</div>
			<div
				class="rounded-xl border border-black/15 bg-white px-4 py-3 text-center text-sm text-[#62748e]"
			>
				บูสต์จะเริ่มหลังวงล้อหยุด จึงไม่เสียเวลารางวัลระหว่างหมุน
			</div>
			{#if wheelAwaitingClaim}
				<button class="primary-button" disabled={submitting} onclick={claimWheelReward}>
					{submitting ? 'กำลังรับ...' : 'รับรางวัลอีกครั้ง'}
				</button>
			{:else}
				<button class="primary-button" disabled={submitting || wheelSpinning} onclick={playWheel}>
					{wheelSpinning ? 'กำลังลงจอด...' : submitting ? 'กำลังเตรียม...' : 'ใช้ตั๋วและหมุน'}
				</button>
			{/if}
		{:else if gameType === 'mystery_box'}
			<p class="eyebrow mt-2">DAILY CARGO</p>
			<div class="rounded-full border-2 border-black bg-white px-5 py-2 text-sm font-black">
				{mysteryRemaining === null
					? 'กำลังตรวจสิทธิ์...'
					: `เหลือ ${mysteryRemaining}/3 ครั้งวันนี้`}
			</div>
			<div
				class="cargo-bay relative grid size-[min(72vw,280px)] place-items-center overflow-hidden rounded-[2.5rem] border-[4px] border-black bg-[#56cfe1] shadow-[9px_10px_0_#111827]"
			>
				<div
					class="absolute inset-0 [background-image:radial-gradient(#111827_1.5px,transparent_1.5px)] [background-size:18px_18px] opacity-20"
				></div>
				<div class="relative {boxShaking ? 'box-shaking' : 'cargo-float'}">
					<Package class="size-24 stroke-[1.4]" />
				</div>
			</div>
			<p class="max-w-xs text-center text-sm font-medium text-[#62748e]">
				กล่องฟรีรีเซ็ตทุกวันตามเวลาไทย และบูสต์เริ่มหลังเปิดเสร็จ
			</p>
			<button
				class="primary-button"
				disabled={submitting || boxShaking || mysteryRemaining === 0}
				onclick={openMysteryBox}
			>
				{boxShaking
					? 'กำลังสแกนพัสดุ...'
					: mysteryRemaining === 0
						? 'รับครบแล้ววันนี้'
						: 'เปิดกล่องฟรี'}
			</button>
		{/if}
	</main>
</div>

<style>
	:global(body) {
		overscroll-behavior: none;
	}

	:global(.intro-card) {
		display: flex;
		width: 100%;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
		border: 3px solid #111827;
		border-radius: 2rem;
		background: white;
		padding: 2rem 1.5rem;
		text-align: center;
		box-shadow: 8px 9px 0 #111827;
	}

	:global(.intro-card h2) {
		font-size: 2rem;
		font-weight: 900;
		line-height: 1.12;
		letter-spacing: -0.035em;
	}

	:global(.intro-card p:not(.eyebrow)) {
		max-width: 19rem;
		font-size: 0.9rem;
		line-height: 1.6;
		color: #62748e;
	}

	:global(.intro-icon) {
		display: grid;
		width: 4.5rem;
		height: 4.5rem;
		place-items: center;
		border: 3px solid #111827;
		border-radius: 1.25rem;
		background: #fdf886;
		font-size: 2.4rem;
		font-weight: 900;
		transform: rotate(-4deg);
		box-shadow: 4px 4px 0 #111827;
	}

	:global(.eyebrow) {
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.22em;
		color: #9a6418;
		text-transform: uppercase;
	}

	:global(.primary-button),
	:global(.secondary-button) {
		border: 2px solid #111827;
		border-radius: 999px;
		padding: 0.8rem 1.5rem;
		font-weight: 900;
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease;
	}

	:global(.primary-button) {
		background: #fdf886;
		color: #7a4f12;
		box-shadow: 4px 4px 0 #111827;
	}

	:global(.secondary-button) {
		background: white;
		box-shadow: 3px 3px 0 #111827;
	}

	:global(.primary-button:active:not(:disabled)),
	:global(.secondary-button:active:not(:disabled)) {
		transform: translate(2px, 2px);
		box-shadow: none;
	}

	:global(.primary-button:disabled),
	:global(.secondary-button:disabled) {
		opacity: 0.45;
	}

	.puzzle-arena {
		background:
			radial-gradient(
				circle at center,
				rgba(253, 248, 134, calc(0.2 + var(--sync) * 0.65)),
				transparent 42%
			),
			#dfe8f3;
		box-shadow: 8px 9px 0 #111827;
	}

	.grid-lines {
		background-image:
			linear-gradient(rgba(17, 24, 39, 0.08) 1px, transparent 1px),
			linear-gradient(90deg, rgba(17, 24, 39, 0.08) 1px, transparent 1px);
		background-size: 28px 28px;
	}

	.beat-ring {
		width: 82%;
		height: 82%;
		transition: opacity 30ms linear;
	}

	.beat-deck.tap-ready {
		background:
			radial-gradient(circle at center, rgba(253, 248, 134, 0.16), transparent 55%), #111827;
	}

	.result-card {
		animation: result-in 0.45s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.box-shaking {
		animation: box-shake 0.18s ease-in-out infinite;
	}

	.cargo-float {
		animation: cargo-float 2.2s ease-in-out infinite;
	}

	@keyframes result-in {
		from {
			transform: translateY(18px) rotate(-1deg) scale(0.94);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}

	@keyframes box-shake {
		0%,
		100% {
			transform: rotate(-5deg) translateX(-5px);
		}
		50% {
			transform: rotate(5deg) translateX(5px);
		}
	}

	@keyframes cargo-float {
		0%,
		100% {
			transform: translateY(0) rotate(-3deg);
		}
		50% {
			transform: translateY(-10px) rotate(3deg);
		}
	}
</style>
