import stats from './stats.json'
import parse from "csv-simple-parser"
import config from "./config.toml"

const studentDataFile = Bun.file("./student_data.csv");
const csv = parse((await studentDataFile.text()).trim(), { header: true, delimiter: "," }).filter(row => !!row) as {
  "ลำดับ": string,
  "รหัสนิสิต": string,
  "ชื่อ-สกุล": string,
  "ชื่อเล่น": string,
  "สาขา": string,
  "ลงทะเบียน": string,
  "แคว้น": string,
  assign_group: string,
  "26/7/68": string,
  "27/7/68": string,
  "28/8/68": string,
  "29/8/68": string,
  "เบอร์โทรน้อง": string,
  "ชื่อผู้ติดต่อฉุกเฉิน": string,
  "หมายเลขติดต่อฉุกเฉิน": string,
  "ข้อจำกัดทางการแพทย์": string,
  "ยาที่แพ้": string,
  "อาหารที่แพ้": string,
  "ข้อจำกัดทางอาหาร": string,
  assigned_update_timestamp: string,
  "ตำหนัก": string
}[];

function getStudentData(studentId: string) {
  const student = csv.find(row => row["รหัสนิสิต"] === studentId);
  if (!student) {
    return null;
  }
  return {
    name: student["ชื่อ-สกุล"],
    major: student["สาขา"],
    nickname: student["ชื่อเล่น"],
    group: student["แคว้น"],
    assignedGroup: student.assign_group,
    subGroup: student["ตำหนัก"],
    contactNumber: student["เบอร์โทรน้อง"],
    emergencyContact: student["ชื่อผู้ติดต่อฉุกเฉิน"],
    emergencyContactNumber: student["หมายเลขติดต่อฉุกเฉิน"],
    medicalLimitations: student["ข้อจำกัดทางการแพทย์"],
    allergies: {
      medication: student["ยาที่แพ้"],
      food: student["อาหารที่แพ้"],
      dietaryRestrictions: student["ข้อจำกัดทางอาหาร"]
    }
  };
}

function numberFormat(num: number): string {
  return num.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const statsSum = stats.reduce((sum, group) => sum + group.totalScore, 0)
for (const group of stats) {
  console.log(`\nแคว้น: ${group.groupNumber}\t${numberFormat(group.totalScore)}\t${numberFormat(group.totalScore / statsSum * 100)}%`);
  for (const [index, student] of Object.entries(group.leaderboard)) {
    const studentData = getStudentData(student.playerId);
    console.log(`${Number(index) + 1}\t${numberFormat(student.score)}\t${student.playerId}\t${studentData?.name}\t${studentData?.nickname}\t${studentData?.subGroup}\t${studentData?.major}`);
  }
}

console.log(`รวมทั้งหมด: ${numberFormat(statsSum)} pops`);