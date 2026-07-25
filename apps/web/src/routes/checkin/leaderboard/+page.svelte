<script lang="ts">
	import { apiClient, call } from '$lib/api';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	type DailyTopPlayer = {
		playerId: string;
		playerName: string;
		ouid: string | null;
		groupNumber: string;
		score: number;
	};
	type DailyGroupTop10 = { groupNumber: string; top10: DailyTopPlayer[] };
	type DailyLeaderboard = { date: string; cutoffAt: string; groups: DailyGroupTop10[] };

	const client = apiClient();

	let days = $state<DailyLeaderboard[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			const res = await call(client.game['daily-leaderboard'].$get());
			days = res.days;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'โหลดผลคะแนนไม่สำเร็จ');
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>คะแนนสูงสุดรายวัน - เทศกาลต้อนรับนิสิตใหม่ คณะวิทย์จุฬา</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold">คะแนนสูงสุดรายวัน (Top 10)</h1>
		<p class="text-muted-foreground text-sm">
			ตัดยอดคะแนน ณ เวลา 17:00 ของแต่ละวัน - แสดงเฉพาะวันที่ถึงเวลาประกาศแล้ว
		</p>
	</div>

	{#if loading}
		<p class="text-muted-foreground text-sm">กำลังโหลด...</p>
	{:else if days.length === 0}
		<p class="text-muted-foreground text-sm">ยังไม่ถึงเวลาประกาศผลของวันใดเลย</p>
	{:else}
		{#each days as day (day.date)}
			<Card>
				<CardHeader>
					<CardTitle>ผลตัดยอด {day.date} เวลา 17:00</CardTitle>
				</CardHeader>
				<CardContent class="flex flex-col gap-6">
					{#if day.groups.length === 0}
						<p class="text-muted-foreground text-sm">ยังไม่มีข้อมูลคะแนน</p>
					{:else}
						{#each day.groups as group (group.groupNumber)}
							<div>
								<h3 class="mb-2 font-semibold">สายการบิน {group.groupNumber}</h3>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead class="w-10">#</TableHead>
											<TableHead>ชื่อ</TableHead>
											<TableHead>รหัสนิสิต</TableHead>
											<TableHead class="text-right">คะแนน</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{#each group.top10 as player, i (player.playerId)}
											<TableRow>
												<TableCell>{i + 1}</TableCell>
												<TableCell>{player.playerName}</TableCell>
												<TableCell>{player.ouid ?? '-'}</TableCell>
												<TableCell class="text-right font-medium">{player.score}</TableCell>
											</TableRow>
										{/each}
									</TableBody>
								</Table>
							</div>
						{/each}
					{/if}
				</CardContent>
			</Card>
		{/each}
	{/if}
</div>
