import z from "zod/v4";

export const registrationSchema = z.object({
  title: z.string().min(1, 'กรุณาเลือกคำนำหน้า'),
  firstName: z.string().min(1, 'กรุณากรอกชื่อ'),
  lastName: z.string().min(1, 'กรุณากรอกนามสกุล'),
  nickname: z.string().min(1, 'กรุณากรอกชื่อเล่น'),
  department: z.string().min(1, 'กรุณาเลือกสาขาวิชา'),
  // email: z.email('กรุณากรอกอีเมลให้ถูกต้อง'),
  phone: z.string().regex(/^[0-9]{10}$/, 'กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก'),
  emergencyContactName: z.string().min(1, 'กรุณากรอกชื่อผู้ติดต่อฉุกเฉิน'),
  emergencyContactPhone: z.string().regex(/^[0-9]{10}$/, 'กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก'),
  emergencyContactRelationship: z.string().min(1, 'กรุณาเลือกความสัมพันธ์'),
  medicalConditions: z.string().optional().default(''),
  drugAllergies: z.string().optional().default(''),
  foodAllergies: z.string().optional().default(''),
  foodLimitations: z.string().optional().default(''),
  // Present only when the Turnstile widget rendered client-side (production
  // only - see PUBLIC_TURNSTILE_SITE_KEY). Optional here so superForm's
  // client-side schema validation never blocks submission on it; the actual
  // requirement is enforced server-side in packages/server/routers/user.ts
  // via siteverify, gated on the request's own isProduction context.
  turnstileToken: z.string().optional()
});
