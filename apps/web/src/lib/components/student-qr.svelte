<script lang="ts">
	import QRCode from 'qrcode';

	let { studentId }: { studentId: string } = $props();
	let canvas = $state<HTMLCanvasElement>();

	$effect(() => {
		if (canvas && studentId) {
			QRCode.toCanvas(canvas, studentId, { width: 240, margin: 2 });
		}
	});
</script>

<div class="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-md">
	<canvas bind:this={canvas}></canvas>
	<p class="font-mono text-2xl tracking-widest">{studentId}</p>
	<p class="text-muted-foreground text-center text-sm">
		ให้สตาฟสแกน QR นี้ หรือบอกรหัสนิสิตเพื่อเช็คอิน
	</p>
</div>
