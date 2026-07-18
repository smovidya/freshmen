<script lang="ts">
	import LoginWithGoogle from './login-with-google.svelte';
	import ProjectLogo from '$lib/assets/logo.webp';
	import { fly } from 'svelte/transition';

	import MobileBGImage from '$lib/assets/640x1137px/640_1137w_bg.png';
	import TablateBGImage from '$lib/assets/768x1024px/768_1024w_bg.png';
	import DesktopBGImage from '$lib/assets/2048x1152px/2048_1152w_bg.png';
	import { authClient } from '$lib/auth/client';
	import Button from '$lib/components/ui/button/button.svelte';
	import { flags } from '$lib/flags';

	const session = authClient.useSession();
</script>

<main class="relative container mx-auto flex min-h-screen flex-col items-center justify-center">
	<div
		class="justify-top fixed inset-0 -z-10 container mx-auto h-full w-full items-start overflow-hidden bg-[#F0CE7D]"
	>
		<img
			srcset="{MobileBGImage} 640w, {TablateBGImage} 768w, {DesktopBGImage} 1440w"
			src={DesktopBGImage}
			alt=""
			class="h-full w-full object-cover object-top"
		/>
	</div>
	<div class="z-10 mx-auto flex min-h-screen flex-col items-center justify-center p-5">
		<div
			class="bg-background/50 mt-5 flex flex-col items-center rounded-2xl border border-white/70 p-7 backdrop-blur-xl md:flex-row"
			in:fly={{
				delay: 100,
				duration: 500,
				x: -100,
				easing: (t) => t * (2 - t) // easeInOut
			}}
		>
			<img
				src={ProjectLogo}
				alt="Project Logo"
				class="mb-4 w-full max-w-96 p-8 [user-drag:none] [user-select:none] md:m-0"
			/>
			<div class="flex w-full flex-col items-start justify-stretch md:items-center">
				<h1 class="w-full text-2xl font-bold">
					เทศกาลต้อนรับนิสิตใหม่ คณะวิทยาศาสตร์ <br />จุฬาลงกรณ์มหาวิทยาลัย
				</h1>
				<p class="mt-2 w-full text-left">
					ลงทะเบียนเข้าร่วมกิจกรรมด้านล่างได้เลย! <br />
				</p>
				{#if $session.data?.user}
					<Button
						href={flags.isEnabled('game-playing') ? '/game' : '/menu'}
						class="mt-4 w-full cursor-pointer">ไปยังเมนู</Button
					>
				{:else}
					<LoginWithGoogle class="mt-4 w-full" />
				{/if}
				<span
					class="mt-2 rounded bg-amber-50/20 px-2 py-1 text-xs text-gray-700 dark:text-gray-400"
				>
					พิเศษเฉพาะนิสิตรหัส 68 คณะวิทยาศาสตร์เท่านั้น
				</span>
			</div>
		</div>
	</div>
</main>
