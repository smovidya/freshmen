<script lang="ts">
	import { apiClient, call, ApiError } from '$lib/api';
	import { PointsStore } from '$lib/points.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	const client = apiClient();
	// game-on.svelte passes its own already-polling PointsStore so the drawer
	// shows the exact number the game page just synced (see game.svelte.ts's
	// syncServerCount) instead of racing it with a second poll of the same
	// balance. points stays optional (falls back to owning its own store) in
	// case this ever gets reused somewhere without one to share - shop is
	// drawer-only now, there's no standalone /game/shop route anymore.
	let { points: sharedPoints }: { points?: PointsStore } = $props();
	const points = sharedPoints ?? new PointsStore();
	const ownsPoints = !sharedPoints;

	type Catalog = {
		buffs: Record<string, { cost: number; multiplier: number; durationMs: number; cap: number }>;
		ticket: { cost: number; gameTypes: readonly string[] };
	};

	let catalog = $state<Catalog | null>(null);
	let busy = $state(false);

	onMount(async () => {
		if (ownsPoints) points.startPolling();
		try {
			catalog = (await call(client.shop.catalog.$get())) as Catalog;
		} catch (e) {
			toast.error('โหลดร้านค้าไม่สำเร็จ');
		}
	});

	onDestroy(() => {
		if (ownsPoints) points.stopPolling();
	});

	async function buyBuff(item: 'buff_x3' | 'buff_x100') {
		if (busy) return;
		busy = true;
		try {
			const result = await call(client.shop.buff.$post({ json: { item } }));
			toast.success(`ซื้อบัฟสำเร็จ! คูณแต้ม x${result.multiplier}`);
			await points.refresh();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'ซื้อบัฟไม่สำเร็จ');
		} finally {
			busy = false;
		}
	}

	async function buyTicket() {
		if (busy) return;
		busy = true;
		try {
			const result = await call(client.shop.ticket.$post());
			toast.success('ได้รับตั๋วมินิเกมแล้ว!');
			await goto(`/game/minigames/${result.gameType}`);
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'ซื้อตั๋วไม่สำเร็จ');
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex w-full flex-col gap-4">
	<div class="rounded-xl bg-white p-4 text-center shadow-sm">
		<p class="text-sm text-[#62748e]">แต้มของคุณ</p>
		<p class="text-[32px] font-semibold text-black">{points.balance}</p>
		{#if points.activeBuff}
			<p class="mt-1 text-sm text-[#9a6418]">
				บัฟ x{points.activeBuff.multiplier} ใช้งานอยู่ ({points.activeBuff.grantedAmount}/{points.activeBuff
					.capAmount})
			</p>
		{/if}
	</div>

	{#if catalog}
		<button
			type="button"
			disabled={busy}
			onclick={() => buyBuff('buff_x3')}
			class="flex flex-col items-start gap-1 rounded-xl bg-[#fdf886] p-4 text-left text-[#9a6418] disabled:opacity-50"
		>
			<span class="text-base font-medium">แต้ม x3 เป็นเวลา 30 วินาที</span>
			<span class="text-sm">{catalog.buffs.buff_x3.cost} แต้ม</span>
		</button>

		<button
			type="button"
			disabled={busy}
			onclick={buyTicket}
			class="flex flex-col items-start gap-1 rounded-xl bg-[#fdf886] p-4 text-left text-[#9a6418] disabled:opacity-50"
		>
			<span class="text-base font-medium">เล่นมินิเกมแบบสุ่ม 1 เกม</span>
			<span class="text-sm">{catalog.ticket.cost} แต้ม</span>
		</button>

		<button
			type="button"
			disabled={busy}
			onclick={() => buyBuff('buff_x100')}
			class="flex flex-col items-start gap-1 rounded-xl bg-[#fdf886] p-4 text-left text-[#9a6418] disabled:opacity-50"
		>
			<span class="text-base font-medium">แต้ม x100 เป็นเวลา 10 วินาที</span>
			<span class="text-sm">{catalog.buffs.buff_x100.cost} แต้ม</span>
		</button>
	{/if}
</div>
