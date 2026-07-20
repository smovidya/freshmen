<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth/client';
	import BackButton from '$lib/components/back-button.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		FormControl,
		FormDescription,
		FormField,
		FormFieldErrors,
		FormLabel
	} from '$lib/components/ui/form/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import Label from '$lib/components/ui/label/label.svelte';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select/index.js';
	import TagChecklist from '$lib/components/tag-checklist.svelte';
	import { departmentIds, departmentLabels } from '$lib/departments';
	import { apiClient, call } from '$lib/api';
	import { registrationSchema } from '@vidyafreshmen/dto';
	import { toast } from 'svelte-sonner';
	import { fromStore } from 'svelte/store';
	import { superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import type { Snapshot } from './$types';
	import PrivacyPolicy from './privacy-policy.svelte';
	import { LoaderIcon } from 'lucide-svelte';

	let { data } = $props();
	const { isRegistered } = $derived(data);

	let session = fromStore(authClient.useSession());
	let email = $derived(session.current.data?.user.email!);
	let studentId = $derived(email?.split('@')[0]);
	let submitting = $state(false);

	const form = superForm(data.form, {
		SPA: true,
		resetForm: false,
		validators: zod4(registrationSchema),
		onUpdate: async ({ form }) => {
			if (!form.valid || submitting) {
				return;
			}
			// console.log('Form submitted:', form.data);
			try {
				submitting = true;
				if (isRegistered) {
					await call(
						apiClient().user['student-info'].$put({
							json: { ...form.data }
						})
					);
					toast.success('บันทึกข้อมูลสำเร็จ 🎉');
				} else {
					await call(
						apiClient().user.register.$post({
							json: { ...form.data }
						})
					);
					toast.success('ลงทะเบียนสำเร็จ 🎉');
				}
			} catch (error) {
				toast.error('เกิดข้อผิดพลาดขึ้น');
				console.error('Error during registration:', error);
				return;
			} finally {
				submitting = false;
			}
			await goto('/menu');
		}
	});

	const { form: formData, enhance } = form;

	const titleOptions = [
		{ value: 'นาย', label: 'นาย' },
		{ value: 'นางสาว', label: 'นางสาว' },
		{ value: 'นาง', label: 'นาง' }
	];

	const departmentOptions = departmentIds.map((id) => ({
		value: id,
		label: departmentLabels[id]
	}));

	const medicalConditionOptions = [
		'โรคหืด',
		'โรคความดันโลหิตสูง',
		'โรคเบาหวาน',
		'โรคหัวใจ',
		'โรคลมชัก',
		'ภาวะพร่องเอนไซม์ G6PD'
	];
	const drugAllergyOptions = ['เพนิซิลลิน', 'แอสไพริน', 'ยากลุ่มซัลฟา', 'ยากลุ่ม NSAIDs'];
	const foodAllergyOptions = ['อาหารทะเล', 'นม/แลกโตส', 'แป้งสาลี', 'ไข่', 'ถั่ว', 'ผงชูรส'];
	const foodLimitationOptions = [
		'ฮาลาล',
		'มังสวิรัติ',
		'ไม่ทานเนื้อสัตว์',
		'ไม่ทานเนื้อวัว',
		'ไม่ทานเนื้อหมู',
		'ไม่ทานไก่',
		'ไม่ทานเผ็ด',
		'ไม่ทานผัก'
	];

	export const snapshot: Snapshot = {
		capture() {
			return $formData;
		},
		restore(snapshot) {
			$formData = snapshot;
		}
	};
</script>

<!-- why escape layout tho -->
<svelte:head>
	<title>เทศกาลต้อนรับนิสิตใหม่ คณะวิทย์จุฬา</title>
</svelte:head>

<section class="mx-auto max-w-[60rem] px-5 py-14">
	<nav class="flex items-center justify-between gap-4">
		<BackButton href="/menu" />
		<h1 class="text-center text-3xl font-medium">ฟอร์มลงทะเบียน</h1>
		<div class="w-10"></div>
	</nav>

	<form method="POST" use:enhance class="mt-12">
		<!-- Personal Information -->
		<h2 class="mt-8 text-2xl font-semibold">ข้อมูลส่วนตัว</h2>
		<div class="relative mt-3 space-y-3 rounded-2xl bg-white p-5 pt-7 shadow-md">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<FormField {form} name="title">
					<FormControl>
						{#snippet children({ props })}
							<FormLabel>คำนำหน้า</FormLabel>
							<Select bind:value={$formData.title} type="single">
								<SelectTrigger {...props} class="w-full">
									{titleOptions.find((option) => option.value === $formData.title)?.label ??
										'เลือกคำนำหน้า'}
								</SelectTrigger>
								<SelectContent>
									{#each titleOptions as option}
										<SelectItem value={option.value}>{option.label}</SelectItem>
									{/each}
								</SelectContent>
							</Select>
						{/snippet}
					</FormControl>
					<FormFieldErrors />
				</FormField>

				<FormField {form} name="firstName">
					<FormControl>
						{#snippet children({ props })}
							<FormLabel>ชื่อ</FormLabel>
							<Input {...props} bind:value={$formData.firstName} placeholder="สมชาย" />
						{/snippet}
					</FormControl>
					<FormFieldErrors />
				</FormField>

				<FormField {form} name="lastName">
					<FormControl>
						{#snippet children({ props })}
							<FormLabel>นามสกุล</FormLabel>
							<Input {...props} bind:value={$formData.lastName} placeholder="ใจดี" />
						{/snippet}
					</FormControl>
					<FormFieldErrors />
				</FormField>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<FormField {form} name="nickname">
					<FormControl>
						{#snippet children({ props })}
							<FormLabel>ชื่อเล่น</FormLabel>
							<Input {...props} bind:value={$formData.nickname} placeholder="ชาย" />
						{/snippet}
					</FormControl>
					<FormFieldErrors />
				</FormField>

				<div class="space-y-2">
					<Label for="student-id">รหัสนิสิต</Label>
					<Input id="student-id" value={studentId} disabled />
				</div>
			</div>

			<FormField {form} name="department">
				<FormControl>
					{#snippet children({ props })}
						<FormLabel>สาขาวิชา</FormLabel>
						<Select bind:value={$formData.department} type="single">
							<SelectTrigger {...props} class="w-full">
								{departmentOptions.find((option) => option.value === $formData.department)?.label ??
									'เลือกสาขาวิชา'}
							</SelectTrigger>
							<SelectContent>
								{#each departmentOptions as option}
									<SelectItem value={option.value}>{option.label}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					{/snippet}
				</FormControl>
				<FormFieldErrors />
			</FormField>
		</div>

		<!-- Contact Information -->
		<h2 class="mt-8 text-2xl font-semibold">ข้อมูลการติดต่อ</h2>
		<div class="mt-3 space-y-3 rounded-2xl bg-white p-5 pt-7 shadow-md">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div class="space-y-2">
					<Label for="email">อีเมล</Label>
					<Input
						type="email"
						id="email"
						value={email}
						placeholder="somchai.j@somchai.com"
						disabled
					/>
				</div>

				<FormField {form} name="phone">
					<FormControl>
						{#snippet children({ props })}
							<FormLabel>หมายเลขโทรศัพท์</FormLabel>
							<Input {...props} type="tel" bind:value={$formData.phone} placeholder="0812345678" />
						{/snippet}
					</FormControl>
					<FormFieldErrors />
				</FormField>
			</div>
		</div>

		<!-- Emergency Contact -->
		<h2 class="mt-8 text-2xl font-semibold">ผู้ติดต่อฉุกเฉิน</h2>
		<div class="mt-3 space-y-3 rounded-2xl bg-white p-5 pt-7 shadow-md">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<FormField {form} name="emergencyContactName">
					<FormControl>
						{#snippet children({ props })}
							<FormLabel>ชื่อผู้ติดต่อฉุกเฉิน</FormLabel>
							<Input
								{...props}
								bind:value={$formData.emergencyContactName}
								placeholder="นางสาวสมหญิง ใจดี"
							/>
						{/snippet}
					</FormControl>
					<FormFieldErrors />
				</FormField>

				<FormField {form} name="emergencyContactPhone">
					<FormControl>
						{#snippet children({ props })}
							<FormLabel>หมายเลขโทรศัพท์ผู้ติดต่อฉุกเฉิน</FormLabel>
							<Input
								{...props}
								type="tel"
								bind:value={$formData.emergencyContactPhone}
								placeholder="0898765432"
							/>
						{/snippet}
					</FormControl>
					<FormFieldErrors />
				</FormField>
			</div>

			<FormField {form} name="emergencyContactRelationship">
				<FormControl>
					{#snippet children({ props })}
						<FormLabel>ความสัมพันธ์</FormLabel>
						<Input
							{...props}
							bind:value={$formData.emergencyContactRelationship}
							placeholder="แม่"
						/>
					{/snippet}
				</FormControl>
				<FormFieldErrors />
			</FormField>
		</div>

		<!-- Medical Information -->
		<h2 class="mt-8 text-2xl font-semibold">ข้อมูลทางการแพทย์ (ไม่บังคับ)</h2>
		<div class="mt-3 space-y-3 rounded-2xl bg-white p-5 pt-7 shadow-md">
			<FormField {form} name="medicalConditions">
				<FormControl>
					{#snippet children()}
						<FormLabel>โรคประจำตัว</FormLabel>
						<TagChecklist
							title="โรคประจำตัว"
							options={medicalConditionOptions}
							bind:value={$formData.medicalConditions}
						/>
						<FormDescription>
							โรคประจำตัวที่อาจส่งผลต่อการเข้าร่วมกิจกรรม การดูแลเบื้องต้น
							และเงื่อนไขทางการแพทย์ที่อาจเป็นประโยชน์
						</FormDescription>
					{/snippet}
				</FormControl>
				<FormFieldErrors />
			</FormField>

			<FormField {form} name="drugAllergies">
				<FormControl>
					{#snippet children()}
						<FormLabel>ข้อมูลการแพ้ยา</FormLabel>
						<TagChecklist
							title="ยาที่แพ้"
							options={drugAllergyOptions}
							bind:value={$formData.drugAllergies}
						/>
					{/snippet}
				</FormControl>
				<FormFieldErrors />
			</FormField>

			<FormField {form} name="foodAllergies">
				<FormControl>
					{#snippet children()}
						<FormLabel>แพ้อาหาร</FormLabel>
						<TagChecklist
							title="อาหารที่แพ้"
							options={foodAllergyOptions}
							bind:value={$formData.foodAllergies}
						/>
					{/snippet}
				</FormControl>
				<FormFieldErrors />
			</FormField>

			<FormField {form} name="foodLimitations">
				<FormControl>
					{#snippet children()}
						<FormLabel>ข้อจำกัดด้านอาหาร</FormLabel>
						<TagChecklist
							title="ข้อจำกัดด้านอาหาร"
							options={foodLimitationOptions}
							bind:value={$formData.foodLimitations}
						/>
					{/snippet}
				</FormControl>
				<FormFieldErrors />
				<FormDescription>
					เหตุผล: เพื่อให้ฝ่ายสวัสดิการสามารถจัดเตรียมอาหารที่เหมาะสมสำหรับท่านได้
				</FormDescription>
			</FormField>
		</div>

		<!-- Privacy Policy -->
		<div class="mt-8 space-y-3 rounded-2xl bg-white p-5 pt-7 shadow-md">
			<PrivacyPolicy />
		</div>
		<div class="bg-muted text-muted-foreground mt-8 rounded-lg p-4 text-center text-sm">
			ในการลงทะเบียนเข้าร่วมกิจกรรมของโครงการฯ ท่านยินยอมให้มีการเก็บรวบรวม ใช้
			และเปิดเผยข้อมูลส่วนบุคคลตามนโยบายนี้
		</div>

		<!-- Submit Button -->
		<div class="flex justify-end pt-6">
			<Button type="submit" size="lg" class="text-md mt-4 h-12 w-full ">
				{#if isRegistered}
					บันทึก
				{:else}
					ลงทะเบียน
				{/if}
				{#if submitting}
					<LoaderIcon class="animate-spin" />
				{/if}
			</Button>
		</div>
	</form>
</section>
