<script lang="ts">
	import { apiClient, call } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';

	type Staff = {
		id: string;
		studentId: string;
		name: string;
		nickname: string | null;
		staffRole: string;
	};

	const client = apiClient();

	let staffs = $state<Staff[]>([]);
	let loading = $state(true);

	let addOpen = $state(false);
	let addStudentId = $state('');
	let addName = $state('');
	let addNickname = $state('');
	let addStaffRole = $state('');
	let adding = $state(false);

	let removeTarget = $state<Staff | null>(null);
	let removing = $state(false);

	async function loadStaffs() {
		loading = true;
		try {
			staffs = (await call(client.staff.$get())) as Staff[];
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ');
		} finally {
			loading = false;
		}
	}

	onMount(loadStaffs);

	function resetAddForm() {
		addStudentId = '';
		addName = '';
		addNickname = '';
		addStaffRole = '';
	}

	async function submitAdd(event: SubmitEvent) {
		event.preventDefault();
		if (!addStudentId.trim() || !addName.trim() || !addStaffRole.trim()) return;
		adding = true;
		try {
			await call(
				client.staff.$post({
					json: {
						studentId: addStudentId.trim(),
						name: addName.trim(),
						nickname: addNickname.trim() || undefined,
						staffRole: addStaffRole.trim()
					}
				})
			);
			toast.success('เพิ่มเจ้าหน้าที่แล้ว');
			addOpen = false;
			resetAddForm();
			await loadStaffs();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'เพิ่มเจ้าหน้าที่ไม่สำเร็จ');
		} finally {
			adding = false;
		}
	}

	async function confirmRemove() {
		if (!removeTarget) return;
		removing = true;
		try {
			await call(client.staff[':id'].$delete({ param: { id: removeTarget.id } }));
			toast.success(`ลบ ${removeTarget.name} แล้ว`);
			removeTarget = null;
			await loadStaffs();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'ลบเจ้าหน้าที่ไม่สำเร็จ');
		} finally {
			removing = false;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">จัดการเจ้าหน้าที่</h1>
			<p class="text-muted-foreground text-sm">เพิ่มและลบเจ้าหน้าที่งานรับน้อง (ไม่ใช่นิสิต)</p>
		</div>
		<Dialog bind:open={addOpen}>
			<Button
				onclick={() => {
					resetAddForm();
					addOpen = true;
				}}
			>
				+ เพิ่มเจ้าหน้าที่
			</Button>
			<DialogContent>
				<form onsubmit={submitAdd}>
					<DialogHeader>
						<DialogTitle>เพิ่มเจ้าหน้าที่</DialogTitle>
						<DialogDescription>กรอกข้อมูลเจ้าหน้าที่ ไม่ใช่นิสิตที่ลงทะเบียน</DialogDescription>
					</DialogHeader>
					<div class="flex flex-col gap-4 py-4">
						<div class="flex flex-col gap-2">
							<Label for="add-student-id">รหัสนิสิต/รหัสประจำตัว</Label>
							<Input id="add-student-id" bind:value={addStudentId} required />
						</div>
						<div class="flex flex-col gap-2">
							<Label for="add-name">ชื่อ-นามสกุล</Label>
							<Input id="add-name" bind:value={addName} required />
						</div>
						<div class="flex flex-col gap-2">
							<Label for="add-nickname">ชื่อเล่น (ไม่บังคับ)</Label>
							<Input id="add-nickname" bind:value={addNickname} />
						</div>
						<div class="flex flex-col gap-2">
							<Label for="add-staff-role">ตำแหน่ง</Label>
							<Input
								id="add-staff-role"
								bind:value={addStaffRole}
								placeholder="เช่น สตาฟ, พี่เลี้ยง, ทีมงาน"
								required
							/>
						</div>
					</div>
					<DialogFooter>
						<Button type="submit" disabled={adding}
							>{adding ? 'กำลังเพิ่ม...' : 'เพิ่มเจ้าหน้าที่'}</Button
						>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	</div>

	<div class="rounded-md border">
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>ชื่อ</TableHead>
					<TableHead>ชื่อเล่น</TableHead>
					<TableHead>รหัส</TableHead>
					<TableHead>ตำแหน่ง</TableHead>
					<TableHead class="text-right">จัดการ</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#if loading}
					<TableRow>
						<TableCell colspan={5} class="text-muted-foreground text-center">กำลังโหลด...</TableCell
						>
					</TableRow>
				{:else if staffs.length === 0}
					<TableRow>
						<TableCell colspan={5} class="text-muted-foreground text-center"
							>ไม่พบเจ้าหน้าที่</TableCell
						>
					</TableRow>
				{:else}
					{#each staffs as staff (staff.id)}
						<TableRow>
							<TableCell>{staff.name}</TableCell>
							<TableCell>{staff.nickname ?? '-'}</TableCell>
							<TableCell>{staff.studentId}</TableCell>
							<TableCell>{staff.staffRole}</TableCell>
							<TableCell class="text-right">
								<Button
									variant="ghost"
									size="sm"
									class="text-destructive"
									onclick={() => (removeTarget = staff)}
								>
									ลบ
								</Button>
							</TableCell>
						</TableRow>
					{/each}
				{/if}
			</TableBody>
		</Table>
	</div>
</div>

<AlertDialog
	open={!!removeTarget}
	onOpenChange={(open) => {
		if (!open) removeTarget = null;
	}}
>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>ลบเจ้าหน้าที่นี้?</AlertDialogTitle>
			<AlertDialogDescription>
				ลบ {removeTarget?.name} ออกจากรายชื่อเจ้าหน้าที่
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel onclick={() => (removeTarget = null)}>ยกเลิก</AlertDialogCancel>
			<AlertDialogAction disabled={removing} onclick={confirmRemove}>
				{removing ? 'กำลังลบ...' : 'ลบ'}
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
