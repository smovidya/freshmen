<script lang="ts">
	import { apiClient, call } from '$lib/api';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { groupData } from '$lib/groups';
	import { Crown, Plane, Trophy } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	type WinnerPlayer = {
		playerId: string;
		playerName: string;
		nickname: string | null;
		department: string | null;
		boeingCode: string | null;
		ouid: string | null;
		groupNumber: string;
		score: number;
	};
	type WinnerGroup = { groupNumber: string; top10: WinnerPlayer[] };
	type WinnerLeaderboard = { cutoffAt: string; groups: WinnerGroup[] };

	const client = apiClient();

	let leaderboard = $state<WinnerLeaderboard | null>(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			leaderboard = await call(client.game['winner-leaderboard'].$get());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'โหลดผลผู้ชนะไม่สำเร็จ');
		} finally {
			loading = false;
		}
	});

	function airlineName(groupNumber: string) {
		return (
			groupData.find((group) => String(group.number) === groupNumber)?.name ??
			`สายการบิน ${groupNumber}`
		);
	}

	function formatCutoff(iso: string) {
		return new Date(iso).toLocaleString('th-TH', {
			dateStyle: 'long',
			timeStyle: 'short',
			timeZone: 'Asia/Bangkok'
		});
	}
</script>

<svelte:head>
	<title>อันดับผู้ชนะ - เทศกาลต้อนรับนิสิตใหม่ คณะวิทย์จุฬา</title>
</svelte:head>

{#snippet groupLeaderboard(group: WinnerGroup)}
	<Card class="overflow-hidden border-amber-200/70 py-0 shadow-sm">
		<CardHeader class="border-b border-amber-100 bg-amber-50/70 py-5">
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<p
						class="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-700 uppercase"
					>
						<Plane class="size-3.5" />
						เที่ยวบิน {group.groupNumber.padStart(2, '0')}
					</p>
					<CardTitle class="truncate text-xl">{airlineName(group.groupNumber)}</CardTitle>
				</div>
				<Badge class="shrink-0 bg-amber-500 text-white hover:bg-amber-500">Top 10</Badge>
			</div>
		</CardHeader>
		<CardContent class="overflow-x-auto p-0">
			{#if group.top10.length === 0}
				<p class="text-muted-foreground p-5 text-sm">ยังไม่มีข้อมูลคะแนน</p>
			{:else}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead class="w-10">#</TableHead>
							<TableHead>ผู้เล่น</TableHead>
							<TableHead>ภาควิชา</TableHead>
							<TableHead>โบอิ้ง</TableHead>
							<TableHead>รหัสนิสิต</TableHead>
							<TableHead class="text-right">คะแนน</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each group.top10 as player, index (player.playerId)}
							<TableRow class={index === 0 ? 'bg-amber-50' : undefined}>
								<TableCell class="font-semibold">
									{#if index === 0}
										<Crown class="size-5 text-amber-500" aria-label="อันดับหนึ่ง" />
									{:else}
										{index + 1}
									{/if}
								</TableCell>
								<TableCell>
									<p class="font-medium">{player.nickname ?? player.playerName}</p>
									{#if player.nickname}
										<p class="text-muted-foreground text-xs">{player.playerName}</p>
									{/if}
								</TableCell>
								<TableCell>{player.department ?? '-'}</TableCell>
								<TableCell>{player.boeingCode ?? '-'}</TableCell>
								<TableCell>{player.ouid ?? '-'}</TableCell>
								<TableCell class="text-right font-semibold tabular-nums">
									{player.score.toLocaleString('th-TH')}
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			{/if}
		</CardContent>
	</Card>
{/snippet}

<div class="flex flex-col gap-6">
	<section
		class="relative isolate overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#78350f,#b45309_58%,#f59e0b)] px-6 py-8 text-white shadow-lg"
	>
		<div class="absolute -top-12 -right-10 -z-10 size-44 rounded-full bg-white/10"></div>
		<div
			class="absolute -right-2 -bottom-16 -z-10 size-36 rounded-full border-[20px] border-white/[0.07]"
		></div>
		<Trophy class="mb-5 size-10 text-amber-200" />
		<p class="text-xs font-bold tracking-[0.22em] text-amber-200 uppercase">Winner leaderboard</p>
		<h1 class="mt-2 text-3xl font-black tracking-tight">อันดับผู้ชนะ Top 10</h1>
		<p class="mt-2 max-w-md text-sm leading-6 text-amber-50/80">
			ผู้ทำคะแนนสูงสุด 10 อันดับของแต่ละสายการบิน ตัดยอดเป็นภาพนิ่ง
			คะแนนที่เกิดขึ้นภายหลังจะไม่เปลี่ยนผลหน้านี้
		</p>
		{#if leaderboard}
			<p
				class="mt-5 inline-flex rounded-full border border-white/15 bg-black/10 px-3 py-1.5 text-xs text-amber-50"
			>
				ตัดยอด ณ {formatCutoff(leaderboard.cutoffAt)}
			</p>
		{/if}
	</section>

	{#if loading}
		<p class="text-muted-foreground py-10 text-center text-sm">กำลังโหลดผลผู้ชนะ...</p>
	{:else if !leaderboard || leaderboard.groups.length === 0}
		<p class="text-muted-foreground py-10 text-center text-sm">ยังไม่มีข้อมูลคะแนนผู้ชนะ</p>
	{:else}
		{#each leaderboard.groups as group (group.groupNumber)}
			{@render groupLeaderboard(group)}
		{/each}
	{/if}
</div>
