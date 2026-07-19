<script lang="ts">
	import TigerCap from '$lib/assets/ci-2026/tiger-cap.webp';
	import TigerCheer from '$lib/assets/ci-2026/tiger-cheer.webp';
	import TigerAir from '$lib/assets/ci-2026/tiger-air.webp';
	import TigerEmpty from '$lib/assets/ci-2026/tiger-empty.webp';
	import { getDisplayName } from '$lib/text-shuffle.svelte';
	import type { TeamMember } from '$lib/type';

	interface Props {
		member: TeamMember[];
	}

	let { member }: Props = $props();
</script>

<div class="relative h-[190px] w-[200px] shrink-0">
	<img
		src={TigerCap}
		alt={getDisplayName(member[0])}
		class="absolute top-0 left-0 h-[102px] w-[108px] object-contain"
	/>
	<img
		src={member[2] ? TigerAir : TigerEmpty}
		alt={member[2] ? getDisplayName(member[2]) : ''}
		class="absolute top-[32px] left-[97px] h-[128px] w-[103px] object-contain"
	/>
	<img
		src={member[1] ? TigerCheer : TigerEmpty}
		alt={member[1] ? getDisplayName(member[1]) : ''}
		class="absolute top-[97px] left-0 h-[89px] w-[120px] object-contain"
	/>
</div>
