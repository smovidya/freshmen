<script lang="ts">
	import BackButton from '$lib/components/back-button.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Bubbles from '../group/bubbles.svelte';
	import MemberList from '../group/member-list.svelte';
	import OpenChatIcon from './open-chat-icon.svelte';
	import { AirportBackdrop } from '$lib/components/festival';

	let { data } = $props();
	const team = $derived(data.joinedTeam ?? data.ownedTeam);
	const group = $derived(data.groupData.find((it) => it.number === data.groupResult));
</script>

<main class="container mx-auto flex h-full max-w-[60rem] flex-col px-5 py-14">
	<AirportBackdrop showCharacter={false} />
	<nav class="mt-64 flex items-center justify-between gap-4">
		<BackButton href="/menu" />
		<div class="text-center">
			<h1 class="text-3xl font-medium">ประกาศผลกรุ๊ป</h1>
		</div>
		<div class="w-10"></div>
	</nav>

	<section class="mt-12 flex flex-col items-center justify-center gap-2">
		<h2 class="rounded-md bg-white/60 px-2 py-1 text-xl font-semibold">กรุ๊ปที่ได้</h2>
		<p class="rounded-md bg-white/60 px-2 py-1">โชคชะตากำหนดให้คุณได้อยู่กรุ๊ป...</p>
		{#if !data.groupResult}
			<div
				class="mt-3 flex w-full flex-col justify-between gap-6 rounded-2xl border border-white/30 bg-white/70 px-5 py-10 shadow-md backdrop-blur-3xl"
			>
				<div class="flex flex-col items-center justify-center gap-3">
					<h2 class="text-3xl">ไม่มีอะไรให้ดู ;-;</h2>
					<p class="text-center">
						เนื่องจากไม่ได้ลงทะเบียนภายใน 21 กรกฎาคม เวลา 23:59 จึงยังไม่ได้ถูกสุ่มลงกลุ่มใดในขณะนี้
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
					<p>กรุ๊ป {group?.number}</p>
				</div>
				<p class="mt-3 text-gray-600">
					<strong>ขั้นต่อไป:</strong> อย่าลืมเข้าโอเพนแชทเพื่อพบปะเพื่อนใหม่ในกรุ๊ปนะ!
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
