import z from "zod/v4";

export const registrationSchema = z.object({
  title: z.string().min(1, 'กรุณาเลือกคำนำหน้า'),
  firstName: z.string().min(1, 'กรุณากรอกชื่อ'),
  lastName: z.string().min(1, 'กรุณากรอกนามสกุล'),
  nickname: z.string().optional(),
  department: z.string().min(1, 'กรุณาเลือกสาขาวิชา'),
  // email: z.email('กรุณากรอกอีเมลให้ถูกต้อง'),
  phone: z.string().regex(/^[0-9]{10}$/, 'กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก'),
  emergencyContactName: z.string().min(1, 'กรุณากรอกชื่อผู้ติดต่อฉุกเฉิน'),
  emergencyContactPhone: z.string().regex(/^[0-9]{10}$/, 'กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก'),
  emergencyContactRelationship: z.string().min(1, 'กรุณาเลือกความสัมพันธ์'),
  medicalConditions: z.string().optional(),
  drugAllergies: z.string().optional(),
  foodAllergies: z.string().optional().default(''),
  foodLimitations: z.string().optional().default('')
});
