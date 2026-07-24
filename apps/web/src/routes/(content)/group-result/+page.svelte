<script lang="ts">
	import { onMount } from 'svelte';
	import confetti from 'canvas-confetti';
	import BackButton from '$lib/components/back-button.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import Bubbles from '../group/bubbles.svelte';
	import MemberList from '../group/member-list.svelte';
	import OpenChatIcon from './open-chat-icon.svelte';
	import { AirportBackdrop, Sign } from '$lib/components/festival';

	let { data } = $props();
	const team = $derived(data.joinedTeam ?? data.ownedTeam);
	const group = $derived(data.groupData.find((it) => it.number === data.groupResult));

	let revealOpen = $state(false);
	let reducedMotion = $state(false);

	function fireConfetti() {
		if (reducedMotion) return;
		const colors = ['#FFDB68', '#4a6fc2', '#ffffff'];
		confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 }, colors });
		confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
		confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
	}

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (!data.groupResult) return;
		const seenKey = `group-reveal-seen-${data.groupResult}`;
		if (localStorage.getItem(seenKey)) return;
		localStorage.setItem(seenKey, '1');
		revealOpen = true;
	});

	$effect(() => {
		if (revealOpen) {
			fireConfetti();
		}
	});
</script>

{#if data.groupResult}
	<Dialog.Root bind:open={revealOpen}>
		<Dialog.Content
			class="max-w-sm overflow-hidden rounded-3xl border-none bg-gradient-to-b from-[#4a6fc2] to-[#2f4a86] p-0 text-center text-white shadow-2xl"
		>
			<div class="flex flex-col items-center gap-3 px-6 py-10">
				<p
					class="text-sm font-medium tracking-wide text-white/80 {reducedMotion
						? ''
						: 'animate-in fade-in slide-in-from-top-2 duration-500'}"
				>
					ยินดีด้วย! คุณได้สายการบิน
				</p>
				<h2
					class="text-4xl font-bold drop-shadow-md {reducedMotion
						? ''
						: 'animate-in zoom-in-50 delay-150 duration-500'}"
				>
					{group?.name}
				</h2>
				<button
					type="button"
					onclick={fireConfetti}
					class="touch-manipulation rounded-full bg-white/15 px-4 py-1 text-lg font-semibold transition-transform duration-150 ease-out active:scale-90"
				>
					สายการบิน {group?.number}
				</button>
				<Button
					onclick={() => (revealOpen = false)}
					size="lg"
					class="mt-4 w-full touch-manipulation cursor-pointer bg-white text-[#2f4a86] shadow-md transition-transform duration-150 ease-out hover:bg-white/90 active:scale-95"
				>
					ดูรายละเอียด
				</Button>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<AirportBackdrop showCharacter={false} showScene={false} showSign={false} />
<main class="container mx-auto flex h-full max-w-[60rem] flex-col px-5 py-14">
	<img
		src={Sign}
		alt="VIDYA FRESHMEN FESTIVAL 2026"
		class="mx-auto w-[85%] max-w-[420px] drop-shadow-lg"
	/>
	<nav class="mt-6 flex items-center justify-between gap-4">
		<BackButton href="/menu" />
		<div class="text-center">
			<h1 class="text-3xl font-medium">ประกาศผลสายการบิน</h1>
		</div>
		<div class="w-10"></div>
	</nav>

	<section class="mt-12 flex flex-col items-center justify-center gap-2">
		<h2 class="rounded-md bg-white/60 px-2 py-1 text-xl font-semibold">สายการบินที่ได้</h2>
		<p class="rounded-md bg-white/60 px-2 py-1">โชคชะตากำหนดให้คุณได้อยู่สายการบิน...</p>
		{#if !data.groupResult}
			<div
				class="mt-3 flex w-full flex-col justify-between gap-6 rounded-2xl border border-white/30 bg-white/70 px-5 py-10 shadow-md backdrop-blur-3xl"
			>
				<div class="flex flex-col items-center justify-center gap-3">
					<h2 class="text-3xl">ไม่มีอะไรให้ดู ;-;</h2>
					<p class="text-center">
						เนื่องจากไม่ได้ลงทะเบียนภายใน 21 กรกฎาคม เวลา 23:59 จึงยังไม่ได้ถูกสุ่มลงสายการบินใดในขณะนี้
						แต่ไม่เป็นไร มาหน้างานได้เลย!
					</p>
				</div>
				<p class="mt-2 text-center text-gray-600">
					หากคิดว่านี่เป็นข้อผิดพลาดกรุณาติดต่อ Instagram @smovidya_official
				</p>
			</div>
		{:else}
			<div
				class="mt-3 flex w-full flex-col justify-between gap-6 rounded-2xl border border-white/30 bg-white/70 p-5 shadow-md backdrop-blur-3xl"
			>
				<div>
					<h2 class="text-3xl">{group?.name}</h2>
					<p>สายการบิน {group?.number}</p>
				</div>
				<p class="mt-3 text-gray-600">
					<strong>ขั้นต่อไป:</strong> อย่าลืมเข้าโอเพนแชทเพื่อพบปะเพื่อนใหม่ในสายการบินนะ!
				</p>
				<Button
					href={group?.link}
					size="lg"
					variant="secondary"
					class="h cursor-pointer bg-green-500 text-white shadow-md hover:bg-green-500/90"
				>
					<OpenChatIcon />
					เข้าร่วมโอเพนแชท
				</Button>
			</div>

			{#if team && team.members.length > 0}
				<section class="mt-12">
					<h2 class="text-xl font-semibold">เพื่อนที่เข้ากลุ่มด้วยกัน</h2>
					<p>กลุ่มเพื่อน 2-3 คนที่เชิญไว้ก่อนหน้านี้</p>
				</section>
				<div
					class="mt-3 flex w-full flex-col items-center justify-around gap-12 rounded-2xl bg-white p-5 pb-6 shadow-md md:flex-row md:gap-3"
				>
					<Bubbles member={[team.owner, ...team.members]} />
					<div class="self-stretch">
						<MemberList {team} done={true} />
					</div>
				</div>
			{/if}
		{/if}
	</section>
</main>
