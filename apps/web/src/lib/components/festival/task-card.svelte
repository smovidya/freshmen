<script lang="ts">
	import { ArrowRight, Check } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	const {
		href,
		title,
		description,
		status = 'ยังไม่ดำเนินการ',
		icon = 'file-user',
		disabled = false,
		done = false
	}: {
		href: string;
		title: string;
		description: string;
		status?: string;
		icon?: any;
		disabled?: boolean;
		done?: boolean;
	} = $props();

	const Icon = icon;
</script>

<a
	href={disabled ? undefined : href}
	data-sveltekit-preload-data="tap"
	class="flex flex-row items-center gap-3 rounded-3xl bg-gradient-to-b from-[#FFE580] to-[#F7C948] p-4 shadow-md transition-all hover:brightness-105 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 sm:gap-4"
	aria-disabled={disabled}
>
	<div
		class="flex size-16 shrink-0 flex-row items-center justify-center rounded-2xl bg-black align-middle shadow-sm sm:size-20"
	>
		{#if done}
			<Check class="size-8 stroke-[3] text-[#FFD447] sm:size-10" />
		{:else}
			<Icon class="size-8 stroke-[1.5] text-white sm:size-10" />
		{/if}
	</div>
	<div class="w-full">
		<h2 class="mb-1 text-lg font-bold text-black sm:text-xl">{title}</h2>
		<p class="w-full text-sm text-black/70">{description}</p>
		<span class={cn('text-xs font-medium', done ? 'text-[#2f8a7f]' : 'text-[#c74137]')}
			>{status}</span
		>
	</div>
	<ArrowRight class="m-2 size-7 shrink-0 stroke-[2.5] text-black" />
</a>
