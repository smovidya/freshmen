<script lang="ts">
	import { cn } from '$lib/utils';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	type Props = HTMLAnchorAttributes;

	let { class: className, ...rest }: Props = $props();
</script>

<a
	class={cn(
		'flex size-10 items-center justify-center rounded-full bg-black/7 text-yellow-950 transition-colors hover:bg-black/10',
		className
	)}
	{...rest}
>
	<ChevronLeft />
</a>
