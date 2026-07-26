<script lang="ts">
	import { apiClient, call } from '$lib/api';
	import { onMount } from 'svelte';
	import NumberFlow from '@number-flow/svelte';

	type GroupTotal = { groupNumber: string; groupLabel: string; totalScore: number };

	const client = apiClient();
	const POLL_INTERVAL_MS = 7000;

	// Per-airline identity palette - each group keeps its own color no matter
	// where it lands in the ranking, so viewers can track "their" airline as
	// bars reorder live on screen. Keyed by groupNumber; "central-staff" is
	// the non-airline central staff group, shown in neutral slate.
	type GroupColor = { bar: string; text: string; glow: string };
	const GROUP_COLORS: Record<string, GroupColor> = {
		'1': { bar: '#fdba74', text: '#7c2d12', glow: 'rgba(253,186,116,0.5)' }, // orange
		'3': { bar: '#c4b5fd', text: '#4c1d95', glow: 'rgba(196,181,253,0.5)' }, // purple
		'4': { bar: '#f9a8d4', text: '#9d174d', glow: 'rgba(249,168,212,0.5)' }, // pink
		'5': { bar: '#fde047', text: '#713f12', glow: 'rgba(253,224,71,0.5)' }, // yellow
		'6': { bar: '#7dd3fc', text: '#0c4a6e', glow: 'rgba(125,211,252,0.5)' }, // sky blue
		'7': { bar: '#f4f1e8', text: '#57534e', glow: 'rgba(244,241,232,0.45)' }, // pearl white
		'central-staff': { bar: '#94a3b8', text: '#1e293b', glow: 'rgba(148,163,184,0.4)' }
	};
	const FALLBACK_COLOR: GroupColor = {
		bar: '#e2e8f0',
		text: '#475569',
		glow: 'rgba(226,232,240,0.3)'
	};

	let groups = $state<GroupTotal[]>([]);
	let loaded = $state(false);
	let pollIntervalId: ReturnType<typeof setInterval> | undefined;

	// Realtime gain popups: diff each poll against the previous totals and
	// float a "+N" chip over the bar that scored. `key` changes per gain so
	// {#key} restarts the CSS animation even for back-to-back gains.
	type Gain = { amount: number; key: number };
	let gains = $state<Record<string, Gain>>({});
	let prevTotals: Record<string, number> = {};

	// Click-to-expand drill-down: top 10 players of the expanded group,
	// refreshed on the same 7s poll cycle as the totals.
	type TopPlayer = { playerId: string; displayName: string; score: number };
	let expandedGroup = $state<string | null>(null);
	let top10 = $state<TopPlayer[]>([]);
	let top10Loaded = $state(false);

	async function loadTop10(groupNumber: string) {
		try {
			const res = await call(
				client.game['scoreboard-top10'][':groupNumber'].$get({ param: { groupNumber } })
			);
			// Guard against a stale response landing after the user already
			// collapsed or switched to another group.
			if (expandedGroup === groupNumber) {
				top10 = res.top10;
				top10Loaded = true;
			}
		} catch {
			// same silent policy as load()
		}
	}

	function toggleExpand(groupNumber: string) {
		if (expandedGroup === groupNumber) {
			expandedGroup = null;
			return;
		}
		expandedGroup = groupNumber;
		top10 = [];
		top10Loaded = false;
		loadTop10(groupNumber);
	}

	async function load() {
		try {
			const res = await call(client.game['scoreboard-public'].$get());
			for (const g of res.groups) {
				const prev = prevTotals[g.groupNumber];
				if (prev !== undefined && g.totalScore > prev) {
					gains[g.groupNumber] = { amount: g.totalScore - prev, key: Date.now() };
				}
				prevTotals[g.groupNumber] = g.totalScore;
			}
			groups = res.groups;
			loaded = true;
			if (expandedGroup) loadTop10(expandedGroup);
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
	class="relative flex min-h-screen w-full flex-col items-center gap-8 overflow-hidden bg-[#0b1220] px-10 py-10 text-white"
	style="font-family: 'Google Sans Variable', sans-serif;"
>
	<!-- Slow ambient glow blobs - cheap "live broadcast" feel on a projector
	     without distracting motion near the numbers. -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<div class="glow-blob top-[-20%] left-[-10%] bg-[#7dd3fc]/15"></div>
		<div
			class="glow-blob right-[-15%] bottom-[-25%] bg-[#c4b5fd]/15"
			style="animation-delay: -6s;"
		></div>
	</div>

	<header class="relative flex w-full max-w-6xl flex-col items-center gap-2 text-center">
		<p class="text-sm font-medium tracking-[0.3em] text-[#7dd3fc] uppercase">Vidya Freshmen 2026</p>
		<h1 class="text-4xl font-bold sm:text-5xl">สรุปคะแนนแต่ละสายการบิน</h1>
		<p class="flex items-center gap-2 text-sm font-medium text-white/50">
			<span class="live-dot" aria-hidden="true"></span>
			LIVE · อัปเดตทุก 7 วินาที
		</p>
	</header>

	<div class="relative flex w-full max-w-6xl flex-1 flex-col gap-4">
		{#if !loaded}
			<p class="text-center text-lg text-white/60">กำลังโหลดคะแนน...</p>
		{:else}
			{#each groups as group, i (group.groupNumber)}
				{@const color = GROUP_COLORS[group.groupNumber] ?? FALLBACK_COLOR}
				{@const pct = percentOf(group.totalScore)}
				{@const gain = gains[group.groupNumber]}
				<div
					class="flex cursor-pointer flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_40px_var(--glow)] backdrop-blur transition-all duration-700 select-none"
					style="--glow: {color.glow};"
					role="button"
					tabindex="0"
					onclick={() => toggleExpand(group.groupNumber)}
					onkeydown={(e) =>
						(e.key === 'Enter' || e.key === ' ') &&
						(e.preventDefault(), toggleExpand(group.groupNumber))}
				>
					<div class="flex items-center gap-6">
						<div
							class="flex size-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-bold"
							style="background: {color.bar}; color: {color.text};"
						>
							{i + 1}
						</div>

						<div class="flex min-w-0 flex-1 flex-col gap-2">
							<div class="flex items-baseline justify-between gap-4">
								<span class="flex min-w-0 items-baseline gap-3">
									<span class="truncate text-2xl font-semibold">{group.groupLabel}</span>
									{#if /^\d+$/.test(group.groupNumber)}
										<span
											class="shrink-0 rounded-full px-3 py-0.5 text-sm font-semibold"
											style="background: {color.bar}22; color: {color.bar};"
										>
											สายการบิน {group.groupNumber}
										</span>
									{/if}
								</span>
								<div class="relative flex shrink-0 items-baseline gap-3">
									{#if gain}
										{#key gain.key}
											<span
												class="gain-pop absolute -top-8 right-0 text-2xl font-bold tabular-nums"
												style="color: {color.bar};"
											>
												+{gain.amount.toLocaleString()}
											</span>
										{/key}
									{/if}
									<span class="text-3xl font-bold tabular-nums" style="color: {color.bar};">
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

					{#if expandedGroup === group.groupNumber}
						<div class="rounded-2xl bg-white/5 p-5">
							{#if !top10Loaded}
								<p class="text-center text-white/50">กำลังโหลด Top 10...</p>
							{:else if top10.length === 0}
								<p class="text-center text-white/50">ยังไม่มีผู้เล่นทำคะแนนในกลุ่มนี้</p>
							{:else}
								<ol class="grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2">
									{#each top10 as player, j (player.playerId)}
										<li class="flex items-center gap-4">
											<span
												class="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
												style="background: {color.bar}22; color: {color.bar};"
											>
												{j + 1}
											</span>
											<span class="min-w-0 flex-1 truncate text-lg">{player.displayName}</span>
											<span
												class="shrink-0 text-lg font-bold tabular-nums"
												style="color: {color.bar};"
											>
												<NumberFlow value={player.score} />
											</span>
										</li>
									{/each}
								</ol>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</main>

<style>
	.glow-blob {
		position: absolute;
		width: 55vw;
		height: 55vw;
		border-radius: 9999px;
		filter: blur(80px);
		animation: blob-drift 14s ease-in-out infinite alternate;
	}

	@keyframes blob-drift {
		from {
			transform: translate3d(0, 0, 0) scale(1);
		}
		to {
			transform: translate3d(4vw, -3vw, 0) scale(1.15);
		}
	}

	.live-dot {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 9999px;
		background: #f87171;
		animation: live-pulse 1.6s ease-in-out infinite;
	}

	@keyframes live-pulse {
		0%,
		100% {
			opacity: 1;
			box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.6);
		}
		50% {
			opacity: 0.55;
			box-shadow: 0 0 0 6px rgba(248, 113, 113, 0);
		}
	}

	.gain-pop {
		animation: gain-float 2.6s ease-out forwards;
		text-shadow: 0 0 18px currentColor;
	}

	@keyframes gain-float {
		0% {
			opacity: 0;
			transform: translateY(0.75rem) scale(0.8);
		}
		15% {
			opacity: 1;
			transform: translateY(0) scale(1.1);
		}
		30% {
			transform: translateY(-0.15rem) scale(1);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-1.4rem) scale(0.95);
		}
	}
</style>
