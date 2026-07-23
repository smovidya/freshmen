<script lang="ts">
	import SceneMobile from '$lib/assets/ci-2026/scene-mobile.webp';
	import SceneDesktop from '$lib/assets/ci-2026/scene-desktop.webp';
	import Sign from '$lib/assets/ci-2026/sign.webp';
	import Airhoss from '$lib/assets/ci-2026/airhoss.webp';

	const {
		showCharacter = true,
		showScene = true,
		showSign = true
	}: { showCharacter?: boolean; showScene?: boolean; showSign?: boolean } = $props();
</script>

<div class="fixed inset-0 -z-10 h-full w-full overflow-hidden bg-[#3c5da8]">
	{#if showScene}
		<img
			srcset="{SceneMobile} 640w, {SceneMobile} 768w, {SceneDesktop} 1440w"
			src={SceneDesktop}
			alt=""
			class="h-full w-full object-cover object-bottom"
		/>
	{/if}
	{#if showSign}
		<img
			src={Sign}
			alt="VIDYA FRESHMEN FESTIVAL 2026"
			class="absolute top-[4%] left-1/2 w-[85%] max-w-[420px] -translate-x-1/2 drop-shadow-lg"
		/>
	{/if}
	{#if showScene && showCharacter}
		<img
			src={Airhoss}
			alt=""
			class="absolute right-[2%] bottom-0 h-[46%] max-h-[420px] object-contain object-bottom sm:h-[52%]"
		/>
	{/if}
</div>
