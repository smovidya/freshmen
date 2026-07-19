<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getDisplayName } from '$lib/text-shuffle.svelte';
	import type { OwnedTeam, TeamMember } from '$lib/type';
	import { LoaderIcon } from 'lucide-svelte';
	import Bubbles from './bubbles.svelte';
	import MemberList from './member-list.svelte';
	interface Props {
		team: OwnedTeam;
		regenerateTeamCodes: () => Promise<unknown>;
		kickMember: (email: string) => Promise<unknown>;
	}

	let { team, regenerateTeamCodes, kickMember }: Props = $props();

	let kickDialogOpen = $state(false);
	// svelte-ignore non_reactive_update
	let selectedMember: TeamMember | null = null;
	let regenerateLoading = $state(false);
	let kickLoading = $state(false);

	function openKickDialog(email: string) {
		selectedMember = [team.owner, ...team.members].find((it) => it.email === email)!;
		kickDialogOpen = true;
	}

	async function confirmKick() {
		if (selectedMember && !kickLoading) {
			kickLoading = true;
			await kickMember(selectedMember.email);
			kickLoading = false;
			kickDialogOpen = false;
			selectedMember = null;
		}
	}

	function cancelKick() {
		kickDialogOpen = false;
	}

	async function onRegenerateTeamCodesClick() {
		if (regenerateLoading) {
			return;
		}
		regenerateLoading = true;
		await regenerateTeamCodes();
		regenerateLoading = false;
	}

	function withoutClass(thing: Record<string, unknown>) {
		const { class: className, ...rest } = thing;
		return rest;
	}
</script>

<AlertDialog.Root bind:open={kickDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title
				>เตะ {selectedMember ? getDisplayName(selectedMember) : ''} ออกจากทีม</AlertDialog.Title
			>
			<AlertDialog.Description>คิดดีแล้วนะ</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={cancelKick}>ยกเลิก</AlertDialog.Cancel>
			<AlertDialog.Action>
				{#snippet child({ props })}
					<Button
						{...withoutClass(props)}
						onclick={confirmKick}
						disabled={kickLoading}
						variant="destructive"
					>
						<span> เตะออกจากทีม </span>
						{#if kickLoading}
							<LoaderIcon class="animate-spin" />
						{/if}
					</Button>
				{/snippet}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<div
	class="flex w-full max-w-full flex-col items-center justify-between gap-3 rounded-2xl bg-[#ffffed] p-5 shadow-md md:h-72 md:flex-row md:gap-0"
>
	<div class="flex flex-col self-stretch md:max-w-64 lg:max-w-72">
		<h3 class="text-2xl font-semibold">สร้างก๊วนมาอยู่ด้วยกัน</h3>
		<p class="mt-2 h-12 leading-5">
			ใคร ๆ ก็อยากเป็นหัวแถว ส่งโค้ดนี้ให้เพื่อนเพื่อเชิญเพื่อนเข้าทีมเลย!
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-4">
			<code class="text-5xl tracking-[0.2em]">{team.teamCodes}</code>
			<Button
				variant="secondary"
				class="w-24"
				disabled={regenerateLoading}
				onclick={onRegenerateTeamCodesClick}
			>
				สร้างใหม่
				{#if regenerateLoading}
					<LoaderIcon class="animate-spin" />
				{/if}
			</Button>
		</div>
		<div class="min-h-8 flex-1"></div>
		<p class="mb-1">หรือถ้าน้องอินโทรเวิร์ด ไม่ต้องส่งให้ใครก็ได้นะ</p>
	</div>
	<Bubbles member={[team.owner, ...team.members]} />
	<MemberList {team} {openKickDialog} />
</div>
