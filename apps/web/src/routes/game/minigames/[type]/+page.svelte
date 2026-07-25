<script lang="ts">
	import { apiClient, call, ApiError } from '$lib/api';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner';
	import House from '@lucide/svelte/icons/house';
	import NumberFlow from '@number-flow/svelte';
	import confetti from 'canvas-confetti';

	let { data } = $props();
	const client = apiClient();
	const gameType = data.gameType;

	let loading = $state(true);
	let submitting = $state(false);
	let result = $state<{ label: string; points: number } | null>(null);

	function celebrate() {
		confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
	}

	async function fail(e: unknown, fallback: string) {
		toast.error(e instanceof ApiError ? e.message : fallback);
		// Shop is a drawer on /game now, not its own route - back to game, open
		// the shop drawer from there (e.g. no ticket for this game type).
		await goto('/game');
	}

	// --- puzzle ---
	let playToken = $state('');
	let range = $state(50);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let dragging = $state(false);

	function onPointerDown(e: PointerEvent) {
		dragging = true;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}
	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		offsetX = Math.max(-range, Math.min(range, offsetX + e.movementX));
		offsetY = Math.max(-range, Math.min(range, offsetY + e.movementY));
	}
	function onPointerUp() {
		dragging = false;
	}

	async function submitPuzzle() {
		if (submitting) return;
		submitting = true;
		try {
			const res = await call(
				client.minigame.puzzle.submit.$post({ json: { playToken, x: offsetX, y: offsetY } })
			);
			if (res.points > 0) celebrate();
			result = { label: `ตรง ${res.accuracy.toFixed(1)}%`, points: res.points };
		} catch (e) {
			toast.error('ส่งไม่สำเร็จ');
		} finally {
			submitting = false;
		}
	}

	// --- precision ---
	let cyclePeriodMs = $state(3700);
	let cycleMax = $state(20);
	let startedAtClient = 0;
	let displayValue = $state(0);
	let rafId = 0;

	function tick() {
		const elapsed = Date.now() - startedAtClient;
		displayValue = (elapsed / (cyclePeriodMs / cycleMax)) % cycleMax;
		rafId = requestAnimationFrame(tick);
	}

	async function submitPrecision() {
		if (submitting) return;
		submitting = true;
		cancelAnimationFrame(rafId);
		try {
			const res = await call(client.minigame.precision.submit.$post({ json: { playToken } }));
			if (res.hit) celebrate();
			result = { label: `หยุดที่ ${res.value.toFixed(2)}`, points: res.points };
		} catch (e) {
			toast.error('ส่งไม่สำเร็จ');
		} finally {
			submitting = false;
		}
	}

	// --- wheel ---
	// Mirrors packages/server/services/minigame/wheel.ts's WHEEL_WEIGHTS -
	// visual only, server rolls the real outcome before the spin even starts.
	// If tuned server-side, update here too to keep slice sizes honest.
	const WHEEL_SLICES_BASE = [
		{ key: 'skull', label: '💀', color: '#3f3f46', weight: 25 },
		{ key: 'pts_100', label: '100', color: '#fde68a', weight: 30 },
		{ key: 'pts_200', label: '200', color: '#fdba74', weight: 20 },
		{ key: 'pts_300', label: '300', color: '#fca5a5', weight: 15 },
		{ key: 'pts_1000', label: '1000', color: '#f87171', weight: 3 },
		{ key: 'buff_x3', label: 'x3', color: '#86efac', weight: 5 },
		{ key: 'buff_x100', label: 'x100', color: '#67e8f9', weight: 2 }
	];
	let wheelCumulative = 0;
	const WHEEL_SLICES = WHEEL_SLICES_BASE.map((s) => {
		const startAngle = wheelCumulative * 3.6;
		wheelCumulative += s.weight;
		const endAngle = wheelCumulative * 3.6;
		return { ...s, startAngle, endAngle, midAngle: (startAngle + endAngle) / 2 };
	});
	const wheelConicGradient = WHEEL_SLICES.map((s) => `${s.color} ${s.startAngle}deg ${s.endAngle}deg`).join(', ');

	const WHEEL_SPIN_MS = 4200;
	let wheelRotation = $state(0);
	let wheelSpinning = $state(false);

	async function playWheel() {
		if (submitting) return;
		submitting = true;
		try {
			const res = await call(client.minigame.wheel.play.$post({ json: {} }));
			const slice = WHEEL_SLICES.find((s) => s.key === res.outcome);
			// Pointer is fixed at the top (0deg) - rotate the wheel so this
			// slice's middle lands there, plus extra full turns for drama. Server
			// already decided the outcome; this is purely the reveal animation.
			const targetWithinTurn = slice ? (360 - slice.midAngle) % 360 : 0;
			wheelSpinning = true;
			wheelRotation = 6 * 360 + targetWithinTurn;
			await new Promise((resolve) => setTimeout(resolve, WHEEL_SPIN_MS + 150));
			wheelSpinning = false;
			if (res.points > 0 || res.outcome.startsWith('buff')) celebrate();
			result = { label: outcomeLabel(res.outcome), points: res.points };
		} catch (e) {
			await fail(e, 'หมุนวงล้อไม่สำเร็จ');
		} finally {
			submitting = false;
		}
	}

	function outcomeLabel(outcome: string) {
		switch (outcome) {
			case 'skull':
				return 'เสียใจด้วย ไม่ได้แต้ม';
			case 'buff_x3':
				return 'ได้รับบัฟ x3 เป็นเวลา 30 วินาที!';
			case 'buff_x100':
				return 'ได้รับบัฟ x100 เป็นเวลา 10 วินาที!';
			default:
				return 'ยินดีด้วย!';
		}
	}

	// --- quiz ---
	type Question = { id: string; questionText: string; choices: string[] };
	let questions = $state<Question[]>([]);
	let answers = $state<Record<string, number>>({});

	async function submitQuiz() {
		if (submitting) return;
		submitting = true;
		try {
			const res = await call(
				client.minigame.quiz.submit.$post({
					json: {
						playToken,
						answers: questions.map((q) => ({ questionId: q.id, choiceIndex: answers[q.id] ?? -1 }))
					}
				})
			);
			if (res.points > 0) celebrate();
			result = { label: `ตอบถูก ${res.correctCount}/3 ข้อ`, points: res.points };
		} catch (e) {
			toast.error('ส่งไม่สำเร็จ');
		} finally {
			submitting = false;
		}
	}

	// --- mystery box ---
	let boxShaking = $state(false);

	async function openMysteryBox() {
		if (submitting) return;
		submitting = true;
		boxShaking = true;
		try {
			const [res] = await Promise.all([
				call(client.minigame.mystery_box.open.$post({ json: {} })),
				new Promise((resolve) => setTimeout(resolve, 900))
			]);
			boxShaking = false;
			if (res.points > 0 || res.outcome.startsWith('buff')) celebrate();
			result = { label: outcomeLabel(res.outcome), points: res.points };
		} catch (e) {
			boxShaking = false;
			await fail(e, 'เปิดกล่องไม่สำเร็จ');
		} finally {
			submitting = false;
		}
	}

	onMount(async () => {
		try {
			if (gameType === 'puzzle') {
				const res = await call(client.minigame.puzzle.start.$post());
				playToken = res.playToken;
				range = res.range;
			} else if (gameType === 'precision') {
				const res = await call(client.minigame.precision.start.$post());
				playToken = res.playToken;
				cyclePeriodMs = res.cyclePeriodMs;
				cycleMax = res.cycleMax;
				startedAtClient = Date.now();
				rafId = requestAnimationFrame(tick);
			} else if (gameType === 'quiz') {
				const res = await call(client.minigame.quiz.start.$post());
				playToken = res.playToken;
				questions = res.questions;
			}
			// wheel and mystery_box need no start step - single action button
		} catch (e) {
			await fail(e, 'เริ่มเกมไม่สำเร็จ (อาจไม่มีตั๋วสำหรับเกมนี้)');
			return;
		}
		loading = false;
	});

	onDestroy(() => cancelAnimationFrame(rafId));
</script>

<Toaster />
<div class="flex min-h-screen w-full flex-col items-center bg-[#f3f2fb]">
	<div class="flex w-full items-center gap-4 p-4">
		<a href="/game" class="flex size-6 items-center justify-center" aria-label="กลับ">
			<House class="size-6" />
		</a>
		<p class="flex-1 text-center text-xl font-semibold text-black">มินิเกม</p>
		<div class="size-6"></div>
	</div>

	<div class="flex w-full max-w-md flex-1 flex-col items-center gap-6 p-4">
		{#if result}
			<div
				class="animate-result-pop flex w-full flex-col items-center gap-2 rounded-xl bg-white p-6 text-center shadow-sm"
			>
				<p class="text-lg font-medium text-black">{result.label}</p>
				<p class="text-[40px] font-semibold text-[#9a6418]">
					<NumberFlow value={result.points} />
				</p>
				<p class="text-sm text-[#62748e]">แต้ม</p>
				<a href="/game" class="mt-2 rounded-full bg-[#fdf886] px-4 py-2 text-sm font-medium text-[#9a6418]">
					กลับไปหน้าเกม
				</a>
			</div>
		{:else if loading}
			<p class="text-[#62748e]">กำลังโหลด...</p>
		{:else if gameType === 'puzzle'}
			<p class="text-center text-sm text-[#62748e]">ลากลูกแก้วให้ตรงกับภาพ แล้วกดยืนยัน</p>
			<div
				class="relative size-[280px] touch-none overflow-hidden rounded-xl border-2 border-dashed border-[#9a6418]/30 bg-[#e2e8f0] select-none"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				role="presentation"
			>
				<!-- Neutral centering guide, not a hint at the (hidden, random) target -->
				<div
					class="pointer-events-none absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#9a6418]/40"
				></div>
				<div
					class="absolute inset-0 flex items-center justify-center text-6xl {dragging
						? 'drop-shadow-2xl'
						: 'drop-shadow-md'}"
					style="transform: translate({offsetX}px, {offsetY}px) scale({dragging ? 1.1 : 1}); transition: {dragging
						? 'none'
						: 'transform 0.15s ease-out'}; cursor: {dragging ? 'grabbing' : 'grab'};"
				>
					🐯
				</div>
			</div>
			<button
				type="button"
				disabled={submitting}
				onclick={submitPuzzle}
				class="rounded-full bg-[#fdf886] px-6 py-3 font-medium text-[#9a6418] transition-transform active:scale-95 disabled:opacity-50"
			>
				ยืนยัน
			</button>
		{:else if gameType === 'precision'}
			<p class="text-center text-sm text-[#62748e]">กดหยุดให้ได้ 10.00 พอดี</p>
			<div class="relative flex size-[220px] items-center justify-center">
				<svg class="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
					<circle cx="50" cy="50" r="46" fill="none" stroke="#e2e8f0" stroke-width="6" />
					<circle
						cx="50"
						cy="50"
						r="46"
						fill="none"
						stroke="#fdf886"
						stroke-width="6"
						stroke-linecap="round"
						stroke-dasharray={2 * Math.PI * 46}
						stroke-dashoffset={2 * Math.PI * 46 * (1 - (displayValue % cycleMax) / cycleMax)}
					/>
				</svg>
				<p class="text-[56px] font-bold text-black tabular-nums">{displayValue.toFixed(2)}</p>
			</div>
			<button
				type="button"
				disabled={submitting}
				onclick={submitPrecision}
				class="rounded-full bg-[#fdf886] px-8 py-4 text-lg font-bold text-[#9a6418] transition-transform active:scale-90 disabled:opacity-50"
			>
				หยุด
			</button>
		{:else if gameType === 'wheel'}
			<p class="text-center text-sm text-[#62748e]">กดหมุนวงล้อเพื่อลุ้นรางวัล</p>
			<div class="relative mx-auto size-[260px]">
				<div class="absolute -top-3 left-1/2 z-20 -translate-x-1/2 text-3xl drop-shadow">🔻</div>
				<div
					class="relative size-full rounded-full border-[6px] border-black shadow-xl"
					style="background: conic-gradient({wheelConicGradient}); transform: rotate({wheelRotation}deg); transition: transform {WHEEL_SPIN_MS}ms cubic-bezier(0.12, 0.67, 0.1, 0.99);"
				>
					{#each WHEEL_SLICES as slice (slice.key)}
						<div
							class="absolute top-1/2 left-1/2 flex items-center justify-center text-base font-black text-black"
							style="transform: translate(-50%, -50%) rotate({slice.midAngle}deg) translateY(-95px);"
						>
							{slice.label}
						</div>
					{/each}
				</div>
				<div
					class="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-[#fdf886]"
				></div>
			</div>
			<button
				type="button"
				disabled={submitting}
				onclick={playWheel}
				class="rounded-full bg-[#fdf886] px-6 py-3 font-medium text-[#9a6418] disabled:opacity-50"
			>
				{wheelSpinning ? 'กำลังหมุน...' : 'หมุนวงล้อ'}
			</button>
		{:else if gameType === 'quiz'}
			<div class="flex items-center gap-2">
				{#each questions as question (question.id)}
					<div
						class="size-2.5 rounded-full transition-colors {answers[question.id] !== undefined
							? 'bg-[#9a6418]'
							: 'bg-[#cad5e2]'}"
					></div>
				{/each}
			</div>
			<div class="flex w-full flex-col gap-4">
				{#each questions as question, i (question.id)}
					<div class="rounded-xl bg-white p-4 shadow-sm">
						<p class="mb-2 font-medium text-black">{i + 1}. {question.questionText}</p>
						<div class="flex flex-col gap-2">
							{#each question.choices as choice, choiceIndex (choiceIndex)}
								<button
									type="button"
									onclick={() => (answers[question.id] = choiceIndex)}
									class="rounded-lg border px-3 py-2 text-left transition-all active:scale-[0.98] {answers[
										question.id
									] === choiceIndex
										? 'border-[#9a6418] bg-[#fdf886] shadow-sm'
										: 'border-[#cad5e2] hover:border-[#9a6418]/50 hover:bg-[#fdf886]/20'}"
								>
									{choice}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<button
				type="button"
				disabled={submitting || Object.keys(answers).length < questions.length}
				onclick={submitQuiz}
				class="rounded-full bg-[#fdf886] px-6 py-3 font-medium text-[#9a6418] transition-transform active:scale-95 disabled:opacity-50"
			>
				ส่งคำตอบ
			</button>
		{:else if gameType === 'mystery_box'}
			<p class="text-center text-sm text-[#62748e]">เปิดกล่องสุ่มของรางวัลฟรี!</p>
			<div
				class="flex size-[200px] items-center justify-center rounded-xl bg-[#fdf886] text-6xl {boxShaking
					? 'animate-box-shake'
					: ''}"
			>
				🎁
			</div>
			<button
				type="button"
				disabled={submitting}
				onclick={openMysteryBox}
				class="rounded-full bg-[#fdf886] px-6 py-3 font-medium text-[#9a6418] transition-transform active:scale-95 disabled:opacity-50"
			>
				{boxShaking ? 'กำลังเปิด...' : 'เปิดกล่อง'}
			</button>
		{/if}
	</div>
</div>

<style>
	@keyframes box-shake {
		0%,
		100% {
			transform: rotate(0deg) translateX(0);
		}
		15% {
			transform: rotate(-8deg) translateX(-4px);
		}
		30% {
			transform: rotate(8deg) translateX(4px);
		}
		45% {
			transform: rotate(-8deg) translateX(-4px);
		}
		60% {
			transform: rotate(8deg) translateX(4px);
		}
		75% {
			transform: rotate(-5deg) translateX(-2px);
		}
		90% {
			transform: rotate(5deg) translateX(2px);
		}
	}
	:global(.animate-box-shake) {
		animation: box-shake 0.5s ease-in-out infinite;
	}

	@keyframes result-pop {
		0% {
			transform: scale(0.85);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}
	:global(.animate-result-pop) {
		animation: result-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
</style>
