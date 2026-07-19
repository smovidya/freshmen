<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as InputOTP from '$lib/components/ui/input-otp';
	import { ShufflingText } from '$lib/text-shuffle.svelte';
	import type { OwnedTeam } from '$lib/type';
	import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'bits-ui';
	import { LoaderIcon, SparkleIcon } from 'lucide-svelte';
	import { Spring } from 'svelte/motion';

	interface Props {
		team: OwnedTeam;
		joinTeam: (teamCodes: string) => Promise<boolean>;
		regenerateTeamCodes: () => Promise<unknown>;
	}

	let { team, joinTeam, regenerateTeamCodes }: Props = $props();

	const teamCodes = new ShufflingText(team.teamCodes);
	$effect(() => {
		teamCodes.set(team.teamCodes);
	});

	/// arggghhh, i want $state.from https://github.com/sveltejs/svelte/issues/12956
	let _codeInput = $state('');
	const codeInput = {
		get current() {
			return _codeInput;
		},
		set current(text: string) {
			_codeInput = text.toUpperCase();
		}
	};

	const offset = new Spring(0, {
		damping: 0.12,
		stiffness: 0.15
	});

	async function shake() {
		offset.damping = 1;
		offset.stiffness = 0.8;
		await offset.set(10);
		offset.damping = 0.12;
		offset.stiffness = 0.15;
		offset.set(0, {});
	}

	let loading = $state(false);
	async function onJoinTeamClick() {
		if (loading) {
			return;
		}
		if (codeInput.current.length < 4) {
			shake();
			return;
		}
		loading = true;
		const ok = await joinTeam(codeInput.current);
		if (!ok) {
			shake();
		}
		loading = false;
	}

	async function onRegenerateTeamCodesClick() {
		if (teamCodes.shuffling) {
			return;
		}
		teamCodes.startShuffle();
		await regenerateTeamCodes();
	}
</script>

<div class="mt-4 flex flex-col justify-center items-center gap-3 md:flex-row">
	<div class="flex w-full flex-col rounded-2xl bg-[#ffffed] p-6 shadow-md md:h-72 md:max-w-84">
		<h3 class="text-2xl font-semibold">สร้างก๊วนมาอยู่ด้วยกัน</h3>
		<p class="mt-2 h-12 leading-5">
			ใคร ๆ ก็อยากเป็นหัวแถว ส่งโค้ดนี้ให้เพื่อนเพื่อเชิญเพื่อนเข้าทีมเลย!
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-4">
			<code class="text-5xl tracking-[0.2em]">{teamCodes.current}</code>
			<Button
				variant="secondary"
				class="w-24"
				disabled={teamCodes.shuffling}
				onclick={onRegenerateTeamCodesClick}
			>
				สร้างใหม่
			</Button>
		</div>
		<div class="min-h-8 flex-1"></div>
		<p class="mb-1">หรือถ้าน้องอินโทรเวิร์ด ไม่ต้องส่งให้ใครก็ได้นะ</p>
	</div>
	<span class="text-lg bg-accent text-accent-foreground px-1 rounded-md">หรือ</span>
	<div class="flex w-full flex-col rounded-2xl bg-[#ffffed] p-6 shadow-md md:h-72 md:max-w-84">
		<h3 class="text-2xl font-semibold">เข้าร่วมก๊วนกับเพื่อน</h3>
		<p class="mt-2 h-12 leading-5">ใส่โค้ดที่ได้จากเพื่อนเพื่อไปอยู่ด้วนกันเล้ย</p>
		<div class="mt-4" style="translate: {offset.current}px 0;">
			<InputOTP.Root
				maxlength={4}
				bind:value={codeInput.current}
				type="text"
				pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
				inputmode="text"
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						onJoinTeamClick();
					}
				}}
			>
				{#snippet children({ cells })}
					<InputOTP.Group>
						{#each cells as cell}
							<InputOTP.Slot inputmode="text" {cell} />
						{/each}
					</InputOTP.Group>
				{/snippet}
			</InputOTP.Root>
		</div>
		<div class="min-h-8 flex-1"></div>
		<Button variant="default" disabled={loading} onclick={onJoinTeamClick}>
			เข้าร่วม
			{#if loading}
				<LoaderIcon class="animate-spin" />
			{/if}
		</Button>
	</div>
</div>
