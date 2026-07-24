<script lang="ts">
	import { apiClient, call, ApiError } from '$lib/api';
	import { PointsStore } from '$lib/points.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	const client = apiClient();
	const points = new PointsStore();

	const GAME_LABELS: Record<string, string> = {
		puzzle: 'เลื่อนภาพให้ตรง',
		precision: 'กดเลขให้ได้ 10.00',
		wheel: 'วงล้อสุ่ม',
		quiz: 'ตอบคำถามไว ๆ',
		mystery_box: 'กล่องสุ่มของรางวัล'
	};

	type Ticket = { id: string; gameType: string; createdAt: string; expiresAt: string };

	let tickets = $state<Ticket[] | null>(null);
	let claiming = $state(false);
	let nowTick = $state(Date.now());
	let tickIntervalId: ReturnType<typeof setInterval>;

	async function load() {
		try {
			tickets = await call(client.minigame.tickets.$get());
		} catch (e) {
			toast.error('โหลดไอเทมไม่สำเร็จ');
		}
	}

	onMount(() => {
		load();
		points.startPolling();
		tickIntervalId = setInterval(() => {
			nowTick = Date.now();
			const status = points.claimStatus;
			if (status && !status.available && status.nextClaimAt && new Date(status.nextClaimAt).getTime() <= nowTick) {
				points.refreshClaimStatus();
			}
		}, 200);
	});

	onDestroy(() => {
		points.stopPolling();
		clearInterval(tickIntervalId);
	});

	function play(gameType: string) {
		goto(`/game/minigames/${gameType}`);
	}

	const claimRemainingMs = $derived.by(() => {
		const status = points.claimStatus;
		if (!status || status.available || !status.nextClaimAt) return 0;
		return Math.max(0, new Date(status.nextClaimAt).getTime() - nowTick);
	});

	const claimCountdownLabel = $derived.by(() => {
		const totalSec = Math.floor(claimRemainingMs / 1000);
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	});

	async function claimFree() {
		if (claiming) return;
		claiming = true;
		try {
			const result = await points.claim();
			toast.success(`รับแต้มฟรี +${result.amount}!`);
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'รับแต้มไม่สำเร็จ');
		} finally {
			claiming = false;
		}
	}
</script>

<div class="flex w-full flex-col gap-4">
	<div class="flex w-full items-center justify-between gap-3 rounded-xl border border-[#cad5e2] bg-white p-4">
		<div>
			<p class="font-medium text-black">เช็คอินรับแต้มฟรี</p>
			<p class="text-sm text-[#62748e]">รับ {points.claimStatus?.amount ?? 500} แต้ม ทุก 3 ชั่วโมง</p>
		</div>
		{#if points.claimStatus?.available}
			<button
				type="button"
				disabled={claiming}
				onclick={claimFree}
				class="shrink-0 rounded-full bg-[#fdf886] px-4 py-2 text-sm font-medium text-[#9a6418] disabled:opacity-50"
			>
				รับเลย
			</button>
		{:else if points.claimStatus}
			<span class="shrink-0 rounded-full bg-black/5 px-3 py-2 text-sm font-medium tabular-nums text-black/60">
				{claimCountdownLabel}
			</span>
		{/if}
	</div>

	<div class="flex w-full flex-col gap-2">
		{#if tickets && tickets.length === 0}
			<p class="py-6 text-center text-sm text-[#62748e]">ยังไม่มีตั๋วมินิเกม ซื้อได้จากร้านค้า</p>
		{/if}
		{#each tickets ?? [] as ticket (ticket.id)}
			<button
				type="button"
				onclick={() => play(ticket.gameType)}
				class="flex items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm"
			>
				<span class="font-medium text-black">{GAME_LABELS[ticket.gameType] ?? ticket.gameType}</span>
				<span class="rounded-full bg-[#fdf886] px-3 py-1 text-sm font-medium text-[#9a6418]">เล่น</span>
			</button>
		{/each}
	</div>
</div>
