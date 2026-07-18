<script lang="ts">
	import AddMeToGroup from './add-me-to-group.svelte';
	import GameOn from './game-on.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { GameAPIClient } from '$lib/game.svelte';
	import { onMount } from 'svelte';
	import { updated } from '$app/state';

	let { data } = $props();

	const client = new GameAPIClient(false);
	onMount(() => {
		client.refreshToken();
	});

	$effect(() => {
		if (updated.current) {
			location.reload()
		}
	})
</script>

<svelte:head>
	<title>ศึกเทพป็อปปลดล็อกแดนสวรรค์</title>
	<meta
		name="description"
		content="ศึกเทพป็อปปลดล็อกแดนสวรรค์ Mini Game กระชับควาสัมพันธ์ระหว่างแคว้นรับน้องทั้ง 6 แห่ง เทศกาลต้อนรับนิสิตใหม่ประจำปี 2569 คณะวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย"
	/>
</svelte:head>

<Toaster />
<main class="subtle-bg flex h-screen flex-col items-center justify-center">
	{#if data.whoami.group}
		<GameOn {client} studentGroup={data.whoami.group} studentOuid={data.whoami.ouid} />
	{:else}
		<AddMeToGroup {client} />
	{/if}
</main>

<style>
	.subtle-bg {
		background-image: url('/bg-subtle.png');
		background-repeat: repeat;
		background-attachment: fixed;
		background-size: 440px;
		background-repeat: repeat;
		-webkit-animation: bg-scrolling-reverse 0.92s infinite;
		/* Safari 4+ */
		-moz-animation: bg-scrolling-reverse 0.92s infinite;
		/* Fx 5+ */
		-o-animation: bg-scrolling-reverse 0.92s infinite;
		/* Opera 12+ */
		animation: bg-scrolling-reverse 0.92s infinite;
		/* IE 10+ */
		-webkit-animation-timing-function: linear;
		-moz-animation-timing-function: linear;
		-o-animation-timing-function: linear;
		animation-timing-function: linear;
	}

	@-webkit-keyframes bg-scrolling-reverse {
		100% {
			background-position: 440px 440px;
		}
	}
	@-moz-keyframes bg-scrolling-reverse {
		100% {
			background-position: 440px 440p;
		}
	}
	@-o-keyframes bg-scrolling-reverse {
		100% {
			background-position: 440px 440px;
		}
	}
	@keyframes bg-scrolling-reverse {
		100% {
			background-position: 440px 440p;
		}
	}

	@-webkit-keyframes bg-scrolling {
		0% {
			background-position: 440px 440px;
		}
	}
	@-moz-keyframes bg-scrolling {
		0% {
			background-position: 440px 440p;
		}
	}
	@-o-keyframes bg-scrolling {
		0% {
			background-position: 440px 440px;
		}
	}
	@keyframes bg-scrolling {
		0% {
			background-position: 440px 440p;
		}
	}
</style>
