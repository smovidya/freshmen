import z from "zod/v4";

export const scanInputSchema = z.object({
  studentIdentifier: z.string().min(1, "Student ID is required"),
  checkpointId: z.string().min(1, "Checkpoint is required"),
});

export const registerWalkinSchema = z.object({
  studentId: z.string().regex(/^\d{10}$/, "Student ID must be 10 digits"),
  title: z.string().min(1, "กรุณาเลือกคำนำหน้า"),
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  nickname: z.string().min(1, "กรุณากรอกชื่อเล่น"),
  department: z.string().min(1, "กรุณาเลือกสาขาวิชา"),
  phone: z.string().regex(/^[0-9]{10}$/, "กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก"),
  emergencyContactName: z.string().min(1, "กรุณากรอกชื่อผู้ติดต่อฉุกเฉิน"),
  emergencyContactPhone: z.string().regex(/^[0-9]{10}$/, "กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก"),
  emergencyContactRelationship: z.string().min(1, "กรุณาเลือกความสัมพันธ์"),
  medicalConditions: z.string().optional().default(""),
  drugAllergies: z.string().optional().default(""),
  foodAllergies: z.string().optional().default(""),
  foodLimitations: z.string().optional().default(""),
});
