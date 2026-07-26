<script lang="ts">
	// Classic 2048 on a 4x4 grid (swipe or arrow keys). Ramp over the round:
	// newly spawned "crate" tiles (immovable, unmergeable - just occupy space
	// and block slides) appear more often as time passes, so the board gets
	// progressively more cramped instead of staying purely a slide-and-merge
	// puzzle the whole time. rawScore = highest tile value reached - reported
	// once at game-over via onGameOver, on no legal moves left or on hitting
	// the overall duration cap (see plan/arcade.ts).
	const SIZE = 4;
	const BLOCKER = -1;
	const BLOCKER_CHANCE_START = 0;
	const BLOCKER_CHANCE_END = 0.16;

	let {
		durationMs,
		onGameOver
	}: {
		durationMs: number;
		onGameOver: (rawScore: number) => void;
	} = $props();

	function emptyGrid(): number[] {
		return Array(SIZE * SIZE).fill(0);
	}

	function emptyCells(grid: number[]) {
		return grid.map((v, i) => i).filter((i) => grid[i] === 0);
	}

	function blockerChance() {
		const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
		return BLOCKER_CHANCE_START + progress * (BLOCKER_CHANCE_END - BLOCKER_CHANCE_START);
	}

	function spawnTile(grid: number[]): number[] {
		const empties = emptyCells(grid);
		if (empties.length === 0) return grid;
		const cell = empties[Math.floor(Math.random() * empties.length)]!;
		const next = [...grid];
		next[cell] = Math.random() < blockerChance() ? BLOCKER : Math.random() < 0.9 ? 2 : 4;
		return next;
	}

	let grid = $state(spawnTile(spawnTile(emptyGrid())));
	let highestTile = $state(2);
	let remainingMs = $state(durationMs);
	let ended = false;

	let tickIntervalId: ReturnType<typeof setInterval> | undefined;
	const startedAt = Date.now();

	function collapseSegment(segment: number[]): { result: number[]; gained: number } {
		const values = segment.filter((v) => v !== 0);
		const result: number[] = [];
		let gained = 0;
		for (let i = 0; i < values.length; i += 1) {
			if (values[i] === values[i + 1]) {
				const merged = values[i]! * 2;
				result.push(merged);
				gained += merged;
				i += 1;
			} else {
				result.push(values[i]!);
			}
		}
		while (result.length < segment.length) result.push(0);
		return { result, gained };
	}

	function slideLine(line: number[]): { result: number[]; gained: number; moved: boolean } {
		const result: number[] = [];
		let gained = 0;
		let segment: number[] = [];
		const flush = () => {
			const collapsed = collapseSegment(segment);
			result.push(...collapsed.result);
			gained += collapsed.gained;
			segment = [];
		};
		for (const value of line) {
			if (value === BLOCKER) {
				flush();
				result.push(BLOCKER);
			} else {
				segment.push(value);
			}
		}
		flush();
		const moved = result.some((v, i) => v !== line[i]);
		return { result, gained, moved };
	}

	function getLine(g: number[], index: number, dir: 'left' | 'right' | 'up' | 'down'): number[] {
		const line: number[] = [];
		for (let k = 0; k < SIZE; k += 1) {
			const i = dir === 'up' || dir === 'down' ? k * SIZE + index : index * SIZE + k;
			line.push(g[i]!);
		}
		if (dir === 'right' || dir === 'down') line.reverse();
		return line;
	}

	function setLine(
		g: number[],
		index: number,
		dir: 'left' | 'right' | 'up' | 'down',
		line: number[]
	) {
		const ordered = dir === 'right' || dir === 'down' ? [...line].reverse() : line;
		for (let k = 0; k < SIZE; k += 1) {
			const i = dir === 'up' || dir === 'down' ? k * SIZE + index : index * SIZE + k;
			g[i] = ordered[k]!;
		}
	}

	function canMove(g: number[]): boolean {
		for (const dir of ['left', 'right', 'up', 'down'] as const) {
			for (let index = 0; index < SIZE; index += 1) {
				if (slideLine(getLine(g, index, dir)).moved) return true;
			}
		}
		return false;
	}

	function endRound() {
		if (ended) return;
		ended = true;
		clearInterval(tickIntervalId);
		onGameOver(highestTile);
	}

	function move(dir: 'left' | 'right' | 'up' | 'down') {
		if (ended) return;
		let next = [...grid];
		let anyMoved = false;
		for (let index = 0; index < SIZE; index += 1) {
			const { result, moved } = slideLine(getLine(next, index, dir));
			if (moved) anyMoved = true;
			setLine(next, index, dir, result);
		}
		if (!anyMoved) return;
		next = spawnTile(next);
		grid = next;
		highestTile = Math.max(highestTile, ...next.filter((v) => v !== BLOCKER));
		if (!canMove(next)) endRound();
	}

	let touchStart: { x: number; y: number } | null = null;
	function onPointerDown(event: PointerEvent) {
		touchStart = { x: event.clientX, y: event.clientY };
	}
	function onPointerUp(event: PointerEvent) {
		if (!touchStart) return;
		const dx = event.clientX - touchStart.x;
		const dy = event.clientY - touchStart.y;
		touchStart = null;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
		if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
		else move(dy > 0 ? 'down' : 'up');
	}
	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') move('left');
		else if (event.key === 'ArrowRight') move('right');
		else if (event.key === 'ArrowUp') move('up');
		else if (event.key === 'ArrowDown') move('down');
	}

	const TILE_COLORS: Record<number, string> = {
		2: '#eef2ff',
		4: '#bde0fe',
		8: '#56cfe1',
		16: '#c7f9cc',
		32: '#fdf886',
		64: '#ffd166',
		128: '#ff9f59',
		256: '#ff7a59',
		512: '#ef476f',
		1024: '#9a1750',
		2048: '#111827'
	};

	$effect(() => {
		tickIntervalId = setInterval(() => {
			remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
			if (remainingMs <= 0) endRound();
		}, 300);

		return () => clearInterval(tickIntervalId);
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex w-full flex-col items-center gap-4">
	<div class="flex w-full items-center justify-between text-sm font-bold text-[#62748e]">
		<span>สูงสุด: {highestTile}</span>
		<span>{(remainingMs / 1000).toFixed(0)}s</span>
	</div>
	<div
		role="application"
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		class="grid touch-none grid-cols-4 gap-2 rounded-2xl border-2 border-black bg-[#101828] p-2"
		style="width: min(80vw, 320px); aspect-ratio: 1;"
	>
		{#each grid as cell, i (i)}
			<div
				class="grid place-items-center rounded-lg text-lg font-black"
				style="background: {cell === BLOCKER
					? '#3f3f46'
					: cell === 0
						? '#1f2937'
						: (TILE_COLORS[cell] ?? '#111827')}; color: {cell === BLOCKER || cell === 0
					? 'transparent'
					: cell >= 8
						? 'white'
						: '#111827'};"
			>
				{cell === BLOCKER ? '📦' : cell === 0 ? '' : cell}
			</div>
		{/each}
	</div>
	<p class="text-xs text-[#62748e]">ปัดหรือกดลูกศรเพื่อรวมเลข</p>
</div>
