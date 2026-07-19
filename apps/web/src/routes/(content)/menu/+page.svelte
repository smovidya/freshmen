<script lang="ts">
	import { TaskCard, TaskSection, FestivalHeader, AirportBackdrop } from '$lib/components/festival';
	import { flags } from '$lib/flags';
	import { getDisplayName } from '$lib/text-shuffle.svelte';
	import { FileUser, ListOrdered, Megaphone, Swords } from 'lucide-svelte';

	let { data } = $props();
	const friends = $derived(
		data.team
			? [...data.team.members, data.team.owner]
					.filter((it) => it.email !== data.whoami.email)
					.map((it) => getDisplayName(it))
			: null
	);
</script>

<AirportBackdrop />
<main class="container mx-auto flex h-full w-full flex-col">
	<FestivalHeader />
	<div class="mt-6 flex flex-col gap-7 sm:p-3">
		<TaskSection subtitle="19 &ndash; 21 กรกฎาคม">
			{#if !flags.isEnabled('registering')}
				<div class="flex flex-row items-center rounded-3xl bg-white/90 p-4 shadow-md sm:gap-4">
					<div class="w-full">
						<h2 class="mb-1 text-xl font-bold text-black">ปิดลงทะเบียนแล้ว</h2>
						<p class="w-full text-black/70">
							เราจะนำข้อมูลที่ลงทะเบียนไปสุ่มและเตรียมกิจกรรมต้อนรับ รอฟังประกาศผลกรุ๊ปในวันที่ 23
							กรกฎาคม เวลา 18:00 น. ที่นี่พร้อมลิงก์เข้าโอเพนแชตจ้า
						</p>
						<p class="text-black/70">
							<b>มีเพื่อนที่ยังไม่ได้ลงทะเบียนใช่ไหม?</b> ไม่เป็นไรเลย ทุกคนสามารถ walk-in ได้ในวันงาน
							แต่กรุ๊ปที่ได้จะเป็นการสุ่มแทนน้า
						</p>
					</div>
				</div>
			{:else}
				<TaskCard
					disabled={!flags.isEnabled('registering')}
					done={data.isRegistered}
					href="/register"
					title="ลงทะเบียนก่อนเข้าร่วมกิจกรรม"
					description="บอกเราหน่อยว่าคุณเป็นใคร"
					status={data.isRegistered ? 'ดำเนินการแล้ว' : 'ยังไม่ดำเนินการ'}
					icon={FileUser}
				/>
				<TaskCard
					disabled={!flags.isEnabled('group-choosing')}
					done={!!friends}
					href="/group"
					title="เรียงลำดับกรุ๊ปที่ชื่นชอบ"
					description="เรียงลำดับกรุ๊ปรับน้องตามที่น้อง ๆ สนใจ พร้อมจับมือเพื่อนไปด้วยอีก 2 คน"
					status={!friends
						? 'ทำตามขั้นตอนข้างบนก่อน'
						: `${friends.length !== 0 ? 'จับกลุ่มกับ ' : ''}${friends.join(
								' และ '
							)} ที่เรียงไว้คือ ${data.team!.groupPreferenceOrder.join(' ')}`}
					icon={ListOrdered}
				/>
			{/if}
		</TaskSection>
		<TaskSection subtitle="23 กรกฎาคม">
			<TaskCard
				disabled={!flags.isEnabled('group-announcement')}
				href="/group-result"
				title="ประกาศผลกรุ๊ป"
				description="ประกาศผลกรุ๊ปที่น้อง ๆ จะได้เป็นสมาชิกตลอดกิจกรรม"
				status={!flags.isEnabled('group-announcement')
					? 'ประกาศภายในวันที่ 23 กรกฎาคม'
					: 'ประกาศผลแล้ว'}
				icon={Megaphone}
			/>
		</TaskSection>
		<TaskSection subtitle="25 &ndash; 27 กรกฎาคม">
			<TaskCard
				disabled={!flags.isEnabled('game-playing')}
				href="/game"
				title="เกมสุดพิเศษล่าความภูมิใจและศักดิ์ศรี"
				description="เล่นได้ในวันที่ 25 กรกฎาคม"
				status="เล่นได้!!!"
				icon={Swords}
			/>
		</TaskSection>
	</div>
</main>
