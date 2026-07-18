<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import Label from '$lib/components/ui/label/label.svelte';

	let {
		value = $bindable(''),
		title,
		options,
		otherLabel = 'อื่น ๆ',
		otherPlaceholder = 'ระบุเพิ่มเติม'
	}: {
		value?: string;
		title: string;
		options: string[];
		otherLabel?: string;
		otherPlaceholder?: string;
	} = $props();

	function parse(raw: string) {
		const parts = raw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		const selected: Record<string, boolean> = {};
		for (const option of options) {
			selected[option] = parts.includes(option);
		}
		const other = parts.filter((p) => !options.includes(p)).join(', ');
		return { selected, other };
	}

	const initial = parse(value);

	let hasAny = $state(value.trim().length > 0);
	let selected = $state<Record<string, boolean>>(initial.selected);
	let otherChecked = $state(initial.other.length > 0);
	let otherText = $state(initial.other);

	const selectedCount = $derived(
		Object.values(selected).filter(Boolean).length + (otherChecked && otherText.trim() ? 1 : 0)
	);

	$effect(() => {
		if (!hasAny) {
			value = '';
			return;
		}
		const parts = options.filter((option) => selected[option]);
		if (otherChecked && otherText.trim()) parts.push(otherText.trim());
		value = parts.join(', ');
	});
</script>

<div class="rounded-xl border p-4">
	<div class="flex items-center justify-between gap-4">
		<div>
			<p class="font-medium">{title}</p>
			{#if hasAny}
				<p class="text-muted-foreground text-sm">เลือกแล้ว {selectedCount} รายการ</p>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<span class="text-muted-foreground text-sm">{hasAny ? 'มี' : 'ไม่มี'}</span>
			<Switch bind:checked={hasAny} />
		</div>
	</div>

	{#if hasAny}
		<div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-3">
			{#each options as option}
				<Label class="flex items-center gap-2 font-normal">
					<Checkbox bind:checked={selected[option]} />
					{option}
				</Label>
			{/each}
			<Label class="flex items-center gap-2 font-normal">
				<Checkbox bind:checked={otherChecked} />
				{otherLabel}
			</Label>
		</div>

		{#if otherChecked}
			<Input class="mt-3" bind:value={otherText} placeholder={otherPlaceholder} />
		{/if}
	{/if}
</div>
