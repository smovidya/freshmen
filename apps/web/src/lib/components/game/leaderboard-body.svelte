<script lang="ts">
	import { apiClient, call } from '$lib/api';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import NumberFlow from '@number-flow/svelte';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';

	type DisplayPlayer = { playerId: string; displayName: string; score: number };
	type CentralGroupTotal = { groupNumber: string; groupLabel: string; totalScore: number };
	type MyGroupLeaderboard = {
		ownGroup: { groupNumber: string; groupLabel: string; top10: DisplayPlayer[] };
		central: CentralGroupTotal[];
	};

	const client = apiClient();
	const POLL_INTERVAL_MS = 5000;

	let data = $state<MyGroupLeaderboard | null>(null);
	let pollIntervalId: ReturnType<typeof setInterval> | undefined;
	let activeTab = $state('own');

	async function load() {
		try {
			data = await call(client.game.leaderboard.$get());
		} catch (e) {
			toast.error('โหลดอันดับคะแนนไม่สำเร็จ');
		}
	}

	onMount(() => {
		load();
		pollIntervalId = setInterval(load, POLL_INTERVAL_MS);
		return () => clearInterval(pollIntervalId);
	});

	// Normalized per-list (own group's own scores; central board's own
	// totals) - a group with a huge lead shouldn't stretch every other bar
	// down to invisible slivers relative to some unrelated global max.
	function widthPct(score: number, max: number): number {
		if (max <= 0) return 0;
		return Math.max(0, Math.min(100, (score / max) * 100));
	}

	const compactFormat = { notation: 'compact', maximumFractionDigits: 1 } as const;
</script>

{#snippet leaderboardRow(label: string, score: number, maxScore: number, highlighted: boolean)}
	<div class="flex flex-col gap-1 rounded-xl bg-white p-3 shadow-sm">
		<div class="flex items-center justify-between gap-2">
			<span class="truncate text-sm font-medium" class:text-[#9a6418]={highlighted} class:text-black={!highlighted}>
				{label}
			</span>
			<span class="shrink-0 text-sm font-semibold text-[#9a6418]">
				<NumberFlow value={score} format={compactFormat} />
			</span>
		</div>
		<div class="h-2 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
			<div
				class="h-full bg-[#fdf886]"
				style="width: {widthPct(score, maxScore)}%; transition: width 0.5s ease-out;"
			></div>
		</div>
	</div>
{/snippet}

{#if data}
	<Tabs bind:value={activeTab} class="flex w-full flex-col gap-4">
		<TabsList>
			<TabsTrigger value="own">กลุ่มของคุณ</TabsTrigger>
			<TabsTrigger value="central">คะแนนรวมแต่ละกลุ่ม</TabsTrigger>
		</TabsList>

		<TabsContent value="own" class="flex flex-col gap-2">
			{#if data.ownGroup.top10.length === 0}
				<p class="text-sm text-[#62748e]">ยังไม่มีใครในกลุ่มของคุณทำคะแนน</p>
			{:else}
				{@const maxScore = data.ownGroup.top10[0]?.score ?? 0}
				<div class="flex flex-col gap-2">
					{#each data.ownGroup.top10 as player, i (player.playerId)}
						{@render leaderboardRow(`${i + 1}. ${player.displayName}`, player.score, maxScore, false)}
					{/each}
				</div>
			{/if}
		</TabsContent>

		<TabsContent value="central" class="flex flex-col gap-2">
			{#if data.central.length === 0}
				<p class="text-sm text-[#62748e]">ยังไม่มีข้อมูล</p>
			{:else}
				{@const maxTotal = data.central[0]?.totalScore ?? 0}
				<div class="flex flex-col gap-2">
					{#each data.central as group (group.groupNumber)}
						{@render leaderboardRow(
							group.groupLabel,
							group.totalScore,
							maxTotal,
							group.groupNumber === data.ownGroup.groupNumber
						)}
					{/each}
				</div>
			{/if}
		</TabsContent>
	</Tabs>
{/if}
