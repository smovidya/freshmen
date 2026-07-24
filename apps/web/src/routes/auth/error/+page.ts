import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	type AuthErrorCode = 'freshmen-only' | 'science-students-only' | 'invalid-email';
	const messages: Record<AuthErrorCode, string> = {
		'freshmen-only':
			'การลงทะเบียนนี้สำหรับนิสิตชั้นปีที่ 1 เท่านั้น หากคุณเป็นนิสิตชั้นปีที่ 1 โปรดติดต่อ https://www.instagram.com/smovidya_official/',
		'science-students-only': 'การลงทะเบียนนี้สำหรับนิสิตคณะวิทยาศาสตร์เท่านั้น',
		'invalid-email': 'ระบบนี้สามารถเข้าสู่ระบบได้เฉพาะนิสิตเท่านั้น (@student.chula.ac.th)'
	};
	const code = url.searchParams.get('code') ?? '';
	if (code in messages) {
		const message = messages[code as keyof typeof messages];
		error(422, {
			message
		});
	} else {
		error(422, {
			message: `เกิดข้อผิดพลาด โปรดตรวจสอบอีเมลที่ใช้เข้าสู่ระบบ: ${code}`
		});
	}
	// return {
	//   message
	// }
};
