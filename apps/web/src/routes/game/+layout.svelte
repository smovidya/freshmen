<script lang="ts">
	import { onMount } from 'svelte';
	import { QteScheduler, VISIBLE_WINDOW_MS } from '$lib/qte.svelte';

	let { children } = $props();

	const qte = new QteScheduler();

	onMount(() => {
		qte.start();
		return () => qte.destroy();
	});
</script>

{@render children()}

{#if qte.visible}
	<button
		type="button"
		onclick={() => qte.claim()}
		class="fixed inset-x-0 top-0 z-[10000] flex w-full items-center gap-3 bg-gradient-to-r from-[#fdf886] to-[#ffe066] px-4 py-3 text-left text-[#7a5a0a] shadow-lg animate-qte-slide-down"
	>
		<span class="text-lg">✨</span>
		<span class="flex-1 text-sm font-semibold">กิจกรรมพิเศษ! แตะเพื่อรับมินิเกมฟรี</span>
		<span class="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-black/10">
			<span
				class="block h-full bg-[#7a5a0a]"
				style="width: {(qte.remainingMs / VISIBLE_WINDOW_MS) * 100}%; transition: width 0.1s linear;"
			></span>
		</span>
	</button>
{/if}

<style>
	@keyframes qte-slide-down {
		from {
			transform: translateY(-100%);
		}
		to {
			transform: translateY(0);
		}
	}
	.animate-qte-slide-down {
		animation: qte-slide-down 0.3s ease-out;
	}
</style>
