<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import type { Group } from '$lib/type';
	import { cn } from '$lib/utils';
	import { LoaderIcon } from 'lucide-svelte';

	interface Props {
		preferences: number[];
		save: (preferences: number[]) => Promise<unknown>;
		groupData: Group[];
	}

	let { preferences, save, groupData }: Props = $props();

	let groups = $state(
		preferences
			.map((prefNumber) => groupData.find((g) => g.number === prefNumber)!)
			.filter((it) => !!it)
			.map((it) => ({ ...it, id: it.number }))
	);

	type GroupWithId = (typeof groups)[number];

	const flipDurationMs = 300;
	function handleDndConsider(e: CustomEvent<DndEvent<GroupWithId>>) {
		groups = e.detail.items;
	}
	function handleDndFinalize(e: CustomEvent<DndEvent<GroupWithId>>) {
		groups = e.detail.items;
	}

	function moveUp(id: number) {
		const index = groups.findIndex((item) => item.id === id);
		if (index > 0) {
			const [item] = groups.splice(index, 1);
			groups.splice(index - 1, 0, item);
		}
	}

	function moveDown(id: number) {
		const index = groups.findIndex((item) => item.id === id);
		if (index < groups.length - 1) {
			const [item] = groups.splice(index, 1);
			groups.splice(index + 1, 0, item);
		}
	}

	let saving = $state(false);
	async function onSaveClicked() {
		if (saving) {
			return;
		}
		saving = true;
		const preferences = groups.map((it) => it.number);
		await save(preferences);
		saving = false;
	}
</script>

<section class="mt-6">
	<div
		class="flex flex-col gap-1.5 {cn(saving && 'cursor-not-allowed opacity-60')}"
		use:dndzone={{ items: groups, dragDisabled: saving, flipDurationMs, dropTargetStyle: {} }}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
	>
		{#each groups as item, index (item.id)}
			<div
				animate:flip={{ duration: flipDurationMs }}
				class="flex w-full items-center justify-between rounded-md bg-[#f8efc9] p-4 shadow-md"
			>
				<div class="ml-1 flex items-center gap-4">
					<span class="text-nowrap">
						สายการบิน {item.number}
					</span>
					<span class="text-lg">
						{item.name}
					</span>
				</div>
				<div class="flex items-center gap-2">
					<Button
						size="icon"
						class="bg-black text-white hover:bg-black/85"
						variant="secondary"
						disabled={index === groups.length - 1}
						onclick={() => moveDown(item.id)}
					>
						<ArrowDown />
					</Button>
					<Button
						size="icon"
						class="bg-black text-white hover:bg-black/85"
						variant="secondary"
						disabled={index === 0}
						onclick={() => moveUp(item.id)}
					>
						<ArrowUp />
					</Button>
					<GripVertical />
				</div>
			</div>
		{/each}
	</div>

	<p class="bg-accent text-accent-foreground mx-4 mt-6 p-4 text-center text-sm">
		หลังจากกดบันทึก น้องสามารถกลับมาแก้ไขเพื่อเชิญเพื่อนและแก้อันดับที่เลือกได้ จนกว่าจะ 24:00 น.
		ของวันที่ 21 กรกฎาคม เมื่อพ้นไปแล้วจะบันทึกตามข้อมูลปัจจุบันอัตโนมัติ
	</p>
	<Button
		disabled={saving}
		onclick={onSaveClicked}
		size="lg"
		class="mt-6 h-12 w-full rounded-[10px] text-lg"
	>
		<span> บันทึก </span>
		{#if saving}
			<LoaderIcon class="animate-spin" />
		{/if}
	</Button>
</section>
