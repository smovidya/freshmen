export function when(condition: () => boolean, fn: () => unknown) {
	const stop = $effect.root(() => {
		$effect(() => {
			if (condition()) {
				fn();
				stop();
			}
		});
	});
}
