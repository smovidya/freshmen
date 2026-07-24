export const departmentLabels = {
	math: 'คณิตศาสตร์',
	comsci: 'วิทยาการคอมพิวเตอร์',
	chemistry: 'เคมี',
	bsac: 'เคมีประยุกต์ (นานาชาติ) (BSAC)',
	physics: 'ฟิสิกส์',
	bio: 'ชีววิทยา',
	botgen: 'พฤกษศาสตร์',
	biochem: 'ชีวเคมี',
	microbio: 'จุลชีววิทยา',
	chemtech: 'เคมีเทคนิค',
	matsci: 'วัสดุศาสตร์',
	imprint: 'เทคโนโลยีทางภาพและการพิมพ์',
	foodtech: 'เทคโนโลยีทางอาหาร',
	geo: 'ธรณีวิทยา',
	'marine-science': 'วิทยาศาสตร์ทางทะเล',
	envi: 'วิทยาศาสตร์สิ่งแวดล้อม',
	bbtech: 'เทคโนโลยีชีวภาพ (นานาชาติ) (BBTech)',
	bistech: 'วิทยาศาสตร์และเทคโนโลยีอุตสาหการ (BISTech)'
} as const;

export type DepartmentId = keyof typeof departmentLabels;
export const departmentIds = Object.keys(departmentLabels) as Array<keyof typeof departmentLabels>;

// Lookup from new ID keys to old acronym keys
export const departmentAcronymLookup: Record<DepartmentId, string> = {
	math: 'Math',
	comsci: 'ComSci',
	chemistry: 'Chem',
	bsac: 'BSAC',
	physics: 'Physics',
	bio: 'Bio',
	botgen: 'BotGen',
	biochem: 'Biochem',
	microbio: 'Micro',
	chemtech: 'ChemTech',
	matsci: 'MatSci',
	imprint: 'ImPrint',
	foodtech: 'FoodTech',
	geo: 'Geo',
	'marine-science': 'Marine',
	envi: 'Envi',
	bbtech: 'BBTech',
	bistech: 'BISTech'
};
