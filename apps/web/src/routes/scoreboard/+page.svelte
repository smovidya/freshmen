<script lang="ts">
	import { apiClient, call } from '$lib/api';
	import { onMount } from 'svelte';
	import NumberFlow from '@number-flow/svelte';

	type GroupTotal = { groupNumber: string; groupLabel: string; totalScore: number };

	const client = apiClient();
	const POLL_INTERVAL_MS = 7000;

	// Fixed per-rank palette (not per-airline identity) - the podium's top
	// three get the boldest colors regardless of which airline currently
	// holds that spot, so the display reads "1st/2nd/3rd" at a glance even
	// when the lead changes live on screen.
	const RANK_COLORS = [
		{ bar: '#fdf886', text: '#7a5a0a', glow: 'rgba(253,248,134,0.55)' },
		{ bar: '#bde0fe', text: '#1d4e89', glow: 'rgba(189,224,254,0.45)' },
		{ bar: '#ffd6e8', text: '#9a1750', glow: 'rgba(255,214,232,0.4)' },
		{ bar: '#c7f9cc', text: '#2d6a4f', glow: 'rgba(199,249,204,0.35)' },
		{ bar: '#e2e8f0', text: '#475569', glow: 'rgba(226,232,240,0.3)' },
		{ bar: '#e2e8f0', text: '#475569', glow: 'rgba(226,232,240,0.3)' }
	];

	let groups = $state<GroupTotal[]>([]);
	let loaded = $state(false);
	let pollIntervalId: ReturnType<typeof setInterval> | undefined;

	async function load() {
		try {
			const res = await call(client.game['scoreboard-public'].$get());
			groups = res.groups;
			loaded = true;
		} catch {
			// silent - a big-screen display just keeps showing the last good
			// frame rather than flashing an error at a room full of people
		}
	}

	onMount(() => {
		load();
		pollIntervalId = setInterval(load, POLL_INTERVAL_MS);
		return () => clearInterval(pollIntervalId);
	});

	const grandTotal = $derived(groups.reduce((sum, g) => sum + g.totalScore, 0));

	function percentOf(score: number): number {
		if (grandTotal <= 0) return 0;
		return (score / grandTotal) * 100;
	}
</script>

<svelte:head>
	<title>สรุปคะแนนสายการบิน</title>
</svelte:head>

<main
	class="flex min-h-screen w-full flex-col items-center gap-8 overflow-hidden bg-[#0b1220] px-10 py-10 text-white"
	style="font-family: 'Google Sans Variable', sans-serif;"
>
	<header class="flex w-full max-w-6xl flex-col items-center gap-2 text-center">
		<p class="text-sm font-medium tracking-[0.3em] text-[#7dd3fc] uppercase">Vidya Freshmen 2026</p>
		<h1 class="text-4xl font-bold sm:text-5xl">สรุปคะแนนแต่ละสายการบิน</h1>
	</header>

	<div class="flex w-full max-w-6xl flex-1 flex-col gap-4">
		{#if !loaded}
			<p class="text-center text-lg text-white/60">กำลังโหลดคะแนน...</p>
		{:else}
			{#each groups as group, i (group.groupNumber)}
				{@const color = RANK_COLORS[Math.min(i, RANK_COLORS.length - 1)]}
				{@const pct = percentOf(group.totalScore)}
				<div
					class="flex items-center gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_40px_var(--glow)] backdrop-blur transition-all duration-700"
					style="--glow: {color.glow};"
				>
					<div
						class="flex size-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-bold"
						style="background: {color.bar}; color: {color.text};"
					>
						{i + 1}
					</div>

					<div class="flex min-w-0 flex-1 flex-col gap-2">
						<div class="flex items-baseline justify-between gap-4">
							<span class="truncate text-2xl font-semibold">{group.groupLabel}</span>
							<div class="flex shrink-0 items-baseline gap-3">
								<span class="text-3xl font-bold tabular-nums" style="color: {color.text === '#475569' ? '#fff' : color.bar};">
									<NumberFlow value={group.totalScore} />
								</span>
								<span class="text-lg font-medium text-white/50 tabular-nums">
									{pct.toFixed(1)}%
								</span>
							</div>
						</div>
						<div class="h-4 w-full overflow-hidden rounded-full bg-white/10">
							<div
								class="h-full rounded-full transition-[width] duration-1000 ease-out"
								style="width: {pct}%; background: {color.bar};"
							></div>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<footer class="text-xs text-white/30">อัปเดตทุก 7 วินาที</footer>
</main>
