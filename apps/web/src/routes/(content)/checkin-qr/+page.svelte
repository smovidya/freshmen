<script lang="ts">
	import BackButton from '$lib/components/back-button.svelte';
	import StudentQr from '$lib/components/student-qr.svelte';
	import { AirportBackdrop, Sign } from '$lib/components/festival';

	let { data } = $props();
	const studentId = $derived(data.whoami.email.split('@')[0]!);
</script>

<AirportBackdrop showCharacter={false} showScene={false} showSign={false} />
<main class="container mx-auto flex h-full max-w-[40rem] flex-col px-5 py-14">
	<img
		src={Sign}
		alt="VIDYA FRESHMEN FESTIVAL 2026"
		class="mx-auto w-[85%] max-w-[420px] drop-shadow-lg"
	/>
	<nav class="mt-6 flex items-center justify-between gap-4">
		<BackButton href="/menu" />
		<div class="text-center">
			<h1 class="text-3xl font-medium">QR เช็คอิน</h1>
		</div>
		<div class="w-10"></div>
	</nav>

	<section class="mt-12 flex flex-col items-center justify-center gap-4">
		<StudentQr {studentId} />
	</section>
</main>
