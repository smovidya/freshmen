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
	async function playWheel() {
		if (submitting) return;
		submitting = true;
		try {
			const res = await call(client.minigame.wheel.play.$post({ json: {} }));
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
	async function openMysteryBox() {
		if (submitting) return;
		submitting = true;
		try {
			const res = await call(client.minigame.mystery_box.open.$post({ json: {} }));
			if (res.points > 0 || res.outcome.startsWith('buff')) celebrate();
			result = { label: outcomeLabel(res.outcome), points: res.points };
		} catch (e) {
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
			<div class="flex w-full flex-col items-center gap-2 rounded-xl bg-white p-6 text-center shadow-sm">
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
				class="relative size-[280px] touch-none overflow-hidden rounded-xl bg-[#e2e8f0]"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				role="presentation"
			>
				<div
					class="absolute inset-0 flex items-center justify-center text-6xl"
					style="transform: translate({offsetX}px, {offsetY}px);"
				>
					🐯
				</div>
			</div>
			<button
				type="button"
				disabled={submitting}
				onclick={submitPuzzle}
				class="rounded-full bg-[#fdf886] px-6 py-3 font-medium text-[#9a6418] disabled:opacity-50"
			>
				ยืนยัน
			</button>
		{:else if gameType === 'precision'}
			<p class="text-center text-sm text-[#62748e]">กดหยุดให้ได้ 10.00 พอดี</p>
			<p class="text-[64px] font-bold text-black tabular-nums">{displayValue.toFixed(2)}</p>
			<button
				type="button"
				disabled={submitting}
				onclick={submitPrecision}
				class="rounded-full bg-[#fdf886] px-6 py-3 font-medium text-[#9a6418] disabled:opacity-50"
			>
				หยุด
			</button>
		{:else if gameType === 'wheel'}
			<p class="text-center text-sm text-[#62748e]">กดหมุนวงล้อเพื่อลุ้นรางวัล</p>
			<div class="flex size-[200px] items-center justify-center rounded-full bg-[#fdf886] text-5xl">🎡</div>
			<button
				type="button"
				disabled={submitting}
				onclick={playWheel}
				class="rounded-full bg-[#fdf886] px-6 py-3 font-medium text-[#9a6418] disabled:opacity-50"
			>
				หมุนวงล้อ
			</button>
		{:else if gameType === 'quiz'}
			<div class="flex w-full flex-col gap-4">
				{#each questions as question, i (question.id)}
					<div class="rounded-xl bg-white p-4 shadow-sm">
						<p class="mb-2 font-medium text-black">{i + 1}. {question.questionText}</p>
						<div class="flex flex-col gap-2">
							{#each question.choices as choice, choiceIndex (choiceIndex)}
								<button
									type="button"
									onclick={() => (answers[question.id] = choiceIndex)}
									class="rounded-lg border px-3 py-2 text-left {answers[question.id] === choiceIndex
										? 'border-[#9a6418] bg-[#fdf886]'
										: 'border-[#cad5e2]'}"
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
				class="rounded-full bg-[#fdf886] px-6 py-3 font-medium text-[#9a6418] disabled:opacity-50"
			>
				ส่งคำตอบ
			</button>
		{:else if gameType === 'mystery_box'}
			<p class="text-center text-sm text-[#62748e]">เปิดกล่องสุ่มของรางวัลฟรี!</p>
			<div class="flex size-[200px] items-center justify-center rounded-xl bg-[#fdf886] text-6xl">🎁</div>
			<button
				type="button"
				disabled={submitting}
				onclick={openMysteryBox}
				class="rounded-full bg-[#fdf886] px-6 py-3 font-medium text-[#9a6418] disabled:opacity-50"
			>
				เปิดกล่อง
			</button>
		{/if}
	</div>
</div>
