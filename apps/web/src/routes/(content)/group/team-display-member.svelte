<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import { getDisplayName } from '$lib/text-shuffle.svelte';
	import type { Group, JoinedTeam } from '$lib/type';
	import { LoaderIcon } from 'lucide-svelte';
	import Bubbles from './bubbles.svelte';
	import MemberList from './member-list.svelte';

	interface Props {
		team: JoinedTeam;
		leaveTeam: () => Promise<unknown>;
		groupData: Group[];
	}

	let { team, leaveTeam, groupData }: Props = $props();

	let groups = $state(
		team.groupPreferenceOrder
			.map((prefNumber) => groupData.find((g) => g.number === prefNumber)!)
			.filter((it) => !!it)
			.map((it) => ({ ...it, id: it.number }))
	);

	let loading = $state(false);
	async function onLeaveTeamClick() {
		if (loading) {
			return;
		}
		loading = true;
		await leaveTeam();
		loading = false;
	}
</script>

<div
	class="mt-3 flex w-full flex-col items-center justify-between gap-12 rounded-2xl bg-[#ffffed] p-5 shadow-md backdrop-blur-lg md:h-80 md:flex-row md:gap-3"
>
	<div class="flex flex-col self-stretch md:max-w-64 lg:max-w-72">
		<h3 class="text-xl font-semibold">คุณอยู่กับ {getDisplayName(team.owner)}!</h3>
		<p class="mt-2 leading-5">
			{getDisplayName(team.owner)} สามารถแก้ไข การเรียงลำดับได้แค่คนเดียว งั้นเราไปคุยกับ{getDisplayName(
				team.owner
			)}
			เรื่องการจัดลำดับใหม่กันอีกทีนะ-!
		</p>
		<div class="min-h-8 flex-1"></div>
		<div class="mt-4 flex flex-col gap-2">
			<p>ทะเลาะกันหรือเปล่า?</p>
			<Button
				disabled={loading}
				variant="secondary"
				class="max-w-42 md:max-w-full"
				onclick={onLeaveTeamClick}
			>
				ออกจากทีมนี้
				{#if loading}
					<LoaderIcon class="animate-spin" />
				{/if}
			</Button>
		</div>
	</div>
	<Bubbles member={[team.owner, ...team.members]} />
	<MemberList {team} />
</div>

<section class="mt-8">
	<h2 class="text-2xl font-semibold">ที่{getDisplayName(team.owner)} เรียงไว้ตอนนี้</h2>
	<div class="mt-2 flex flex-col gap-1.5">
		{#each groups as group (group.number)}
			<div class="flex w-full items-center justify-between rounded-md bg-[#f8efc9] p-4 shadow-md">
				<div class="ml-1 flex items-center gap-4">
					<span>
						กรุ๊ป {group.id}
					</span>
					<span class="text-lg">
						{group.name}
					</span>
				</div>
			</div>
		{/each}
	</div>
</section>
