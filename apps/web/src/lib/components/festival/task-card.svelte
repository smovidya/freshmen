<script lang="ts">
	import { ArrowRight, Check } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { page } from '$app/state';

	type Role = 'user' | 'staff' | 'admin';

	const {
		href,
		title,
		description,
		status = 'ยังไม่ดำเนินการ',
		icon = 'file-user',
		disabled = false,
		done = false,
		roles
	}: {
		href: string;
		title: string;
		description: string;
		status?: string;
		icon?: any;
		disabled?: boolean;
		done?: boolean;
		/** Only show this card to users whose role is in this list. Omit to show to everyone. */
		roles?: Role[];
	} = $props();

	const Icon = $derived(icon);
	const currentRole = $derived((page.data.whoami?.role ?? 'user') as Role);
	const visible = $derived(!roles || roles.includes(currentRole));
</script>

{#if visible}
	<a
		href={disabled ? undefined : href}
		data-sveltekit-preload-data="tap"
		class="group relative flex flex-row items-center gap-3 rounded-3xl bg-[#FFDB68] p-4 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:translate-y-0 aria-disabled:hover:shadow-md sm:gap-4"
		aria-disabled={disabled}
	>
		<div
			class="flex size-16 shrink-0 flex-row items-center justify-center rounded-2xl bg-black align-middle shadow-sm sm:size-20"
		>
			{#if done}
				<Check class="size-8 stroke-[3] text-[#FFDB68] sm:size-10" />
			{:else}
				<Icon class="size-8 stroke-[1.5] text-white sm:size-10" />
			{/if}
		</div>
		<div class="min-w-0 flex-1">
			<h2 class="mb-1 text-lg font-bold text-black sm:text-xl">{title}</h2>
			<p class="w-full text-sm text-black/70">{description}</p>
			<span
				class={cn(
					'mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
					done ? 'bg-[#3aa095]/15 text-[#3aa095]' : 'bg-[#c74137]/15 text-[#c74137]'
				)}>{status}</span
			>
		</div>
		<div class="hidden self-stretch border-l-2 border-dashed border-black/15 sm:block"></div>
		<div
			class="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/5 text-black transition-colors group-hover:bg-black/10 sm:size-10"
		>
			<ArrowRight class="size-4 stroke-[2.5] sm:size-5" />
		</div>
	</a>
{/if}
