<script lang="ts">
	import { apiClient, call, ApiError } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
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
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';

	type AdminGroup = {
		id: string;
		number: string;
		name: string;
		maxMembers: number;
		hasPassword: boolean;
	};

	const client = apiClient();

	let groups = $state<AdminGroup[]>([]);
	let loading = $state(true);

	async function loadGroups() {
		loading = true;
		try {
			groups = await call(client.groups.$get());
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : 'โหลดรายชื่อกลุ่มไม่สำเร็จ');
		} finally {
			loading = false;
		}
	}

	onMount(loadGroups);

	let editTarget = $state<AdminGroup | null>(null);
	let newPassword = $state('');
	let saving = $state(false);

	function openEdit(group: AdminGroup) {
		editTarget = group;
		newPassword = '';
	}

	async function saveEdit(event: SubmitEvent) {
		event.preventDefault();
		if (!editTarget || !newPassword.trim()) return;
		saving = true;
		try {
			await call(client.groups[':id'].password.$put({
				param: { id: editTarget.id },
				json: { password: newPassword.trim() }
			}));
			toast.success(`ตั้งรหัสผ่านของ ${editTarget.name} ใหม่แล้ว`);
			editTarget = null;
			await loadGroups();
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : 'ตั้งรหัสผ่านไม่สำเร็จ');
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold">รหัสเข้าร่วมกลุ่ม/สายการบิน</h1>
		<p class="text-muted-foreground text-sm">
			ตั้งรหัสผ่านที่ใช้เข้าร่วมสายการบิน หรือกลุ่มสตาฟกลาง (ดูค่าเดิมไม่ได้ ตั้งใหม่ได้อย่างเดียว)
		</p>
	</div>

	<div class="rounded-md border">
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>หมายเลข</TableHead>
					<TableHead>ชื่อ</TableHead>
					<TableHead>สมาชิกสูงสุด</TableHead>
					<TableHead>รหัสผ่าน</TableHead>
					<TableHead class="text-right">จัดการ</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#if loading}
					<TableRow>
						<TableCell colspan={5} class="text-muted-foreground text-center">กำลังโหลด...</TableCell>
					</TableRow>
				{:else if groups.length === 0}
					<TableRow>
						<TableCell colspan={5} class="text-muted-foreground text-center">ไม่พบกลุ่ม</TableCell>
					</TableRow>
				{:else}
					{#each groups as group (group.id)}
						<TableRow>
							<TableCell>{group.number}</TableCell>
							<TableCell>{group.name}</TableCell>
							<TableCell>{group.maxMembers}</TableCell>
							<TableCell>
								<Badge variant={group.hasPassword ? 'secondary' : 'destructive'}>
									{group.hasPassword ? 'ตั้งค่าแล้ว' : 'ยังไม่ตั้ง'}
								</Badge>
							</TableCell>
							<TableCell class="text-right">
								<Button variant="outline" size="sm" onclick={() => openEdit(group)}>
									ตั้งรหัสผ่านใหม่
								</Button>
							</TableCell>
						</TableRow>
					{/each}
				{/if}
			</TableBody>
		</Table>
	</div>
</div>

<Dialog
	open={!!editTarget}
	onOpenChange={(open) => {
		if (!open) editTarget = null;
	}}
>
	<DialogContent>
		<form onsubmit={saveEdit}>
			<DialogHeader>
				<DialogTitle>ตั้งรหัสผ่านใหม่ - {editTarget?.name}</DialogTitle>
				<DialogDescription>
					รหัสเดิมจะใช้ไม่ได้ทันทีที่บันทึก แจ้งรหัสใหม่ให้คนที่ต้องใช้ด้วย
				</DialogDescription>
			</DialogHeader>
			<div class="flex flex-col gap-2 py-4">
				<Label for="new-password">รหัสผ่านใหม่</Label>
				<Input id="new-password" bind:value={newPassword} placeholder="กรอกรหัสผ่านใหม่" required />
			</div>
			<DialogFooter>
				<Button type="submit" disabled={saving || !newPassword.trim()}>
					{saving ? 'กำลังบันทึก...' : 'บันทึก'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
