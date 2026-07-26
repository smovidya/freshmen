<script lang="ts">
	import { apiClient, call, ApiError } from '$lib/api';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	type AnomalyUserSummary = {
		userId: string;
		playerName: string;
		ouid: string | null;
		groupNumber: string | null;
		total: number;
		countsByType: Record<string, number>;
		lastAt: string;
	};
	type AnomalyEventRow = {
		id: string;
		type: string;
		detail: string | null;
		createdAt: string;
	};

	const TYPE_LABELS: Record<string, string> = {
		pop_token_invalid: 'โทเคนไม่ถูกต้อง/ซ้ำ',
		pop_rate_clamped: 'ส่งแต้มเกินอัตราที่เป็นไปได้'
	};

	const client = apiClient();

	let summaries = $state<AnomalyUserSummary[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			summaries = await call(client.game.anomalies.$get());
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : 'โหลดรายงานไม่สำเร็จ');
		} finally {
			loading = false;
		}
	});

	let detailTarget = $state<AnomalyUserSummary | null>(null);
	let events = $state<AnomalyEventRow[] | null>(null);

	async function openDetail(summary: AnomalyUserSummary) {
		detailTarget = summary;
		events = null;
		try {
			events = await call(
				client.game.anomalies[':userId'].$get({ param: { userId: summary.userId } })
			);
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : 'โหลดรายละเอียดไม่สำเร็จ');
		}
	}

	function formatTime(iso: string) {
		return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
	}
</script>

<svelte:head>
	<title>รายงานพฤติกรรมผิดปกติ - ผู้ดูแลระบบ</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold">รายงานพฤติกรรมผิดปกติ (anti-cheat)</h1>
		<p class="text-muted-foreground text-sm">
			เหตุการณ์จากระบบเกม เช่น ใช้โทเคนซ้ำ หรือส่งแต้มเร็วเกินอัตราที่มนุษย์ทำได้ -
			เรียงจากผู้ที่มีเหตุการณ์มากที่สุด ข้อมูลนี้ใช้ประกอบการตรวจสอบ ไม่ได้ตัดสิทธิ์อัตโนมัติ
		</p>
	</div>

	<div class="rounded-md border">
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>ชื่อ</TableHead>
					<TableHead>รหัสนิสิต</TableHead>
					<TableHead>สายการบิน</TableHead>
					<TableHead>ประเภทเหตุการณ์</TableHead>
					<TableHead class="text-right">รวม</TableHead>
					<TableHead>ล่าสุด</TableHead>
					<TableHead class="text-right">ดู</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#if loading}
					<TableRow>
						<TableCell colspan={7} class="text-muted-foreground text-center">กำลังโหลด...</TableCell
						>
					</TableRow>
				{:else if summaries.length === 0}
					<TableRow>
						<TableCell colspan={7} class="text-muted-foreground text-center"
							>ไม่มีเหตุการณ์ผิดปกติ</TableCell
						>
					</TableRow>
				{:else}
					{#each summaries as summary (summary.userId)}
						<TableRow>
							<TableCell>{summary.playerName}</TableCell>
							<TableCell>{summary.ouid ?? '-'}</TableCell>
							<TableCell>{summary.groupNumber ?? '-'}</TableCell>
							<TableCell class="flex flex-wrap gap-1">
								{#each Object.entries(summary.countsByType) as [type, n] (type)}
									<Badge variant="secondary">{TYPE_LABELS[type] ?? type}: {n}</Badge>
								{/each}
							</TableCell>
							<TableCell class="text-right font-medium">{summary.total}</TableCell>
							<TableCell>{formatTime(summary.lastAt)}</TableCell>
							<TableCell class="text-right">
								<Button variant="outline" size="sm" onclick={() => openDetail(summary)}>
									รายละเอียด
								</Button>
							</TableCell>
						</TableRow>
					{/each}
				{/if}
			</TableBody>
		</Table>
	</div>
</div>

<Dialog
	open={!!detailTarget}
	onOpenChange={(open) => {
		if (!open) detailTarget = null;
	}}
>
	<DialogContent class="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
		<DialogHeader>
			<DialogTitle>
				{detailTarget?.playerName} ({detailTarget?.ouid ?? '-'})
			</DialogTitle>
			<DialogDescription>เหตุการณ์ล่าสุด (สูงสุด 100 รายการ)</DialogDescription>
		</DialogHeader>
		{#if events === null}
			<p class="text-muted-foreground text-sm">กำลังโหลด...</p>
		{:else if events.length === 0}
			<p class="text-muted-foreground text-sm">ไม่มีเหตุการณ์</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each events as event (event.id)}
					<div class="rounded-md border p-2 text-sm">
						<div class="flex items-center justify-between gap-2">
							<Badge variant="secondary">{TYPE_LABELS[event.type] ?? event.type}</Badge>
							<span class="text-muted-foreground text-xs">{formatTime(event.createdAt)}</span>
						</div>
						{#if event.detail}
							<pre class="text-muted-foreground mt-1 overflow-x-auto text-xs">{event.detail}</pre>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</DialogContent>
</Dialog>
