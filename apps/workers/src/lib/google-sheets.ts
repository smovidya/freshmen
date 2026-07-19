import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet, type GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

export function getServiceAccountAuth(env: Env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google service account credentials are not set in environment variables');
  }
  return new JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // env vars store the PEM with literal "\n" escapes (dotenv-style, single-line) -
    // gtoken/jws sign with this string as-is and need real line breaks to parse it.
    key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export function getSpreadsheetId(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error(`Could not parse spreadsheet id from url: ${url}`);
  }
  return match[1];
}

export async function getDoc(spreadsheetId: string, auth: JWT): Promise<GoogleSpreadsheet> {
  const doc = new GoogleSpreadsheet(spreadsheetId, auth);
  await doc.loadInfo();
  return doc;
}

export async function getOrCreateSheet(
  doc: GoogleSpreadsheet,
  title: string,
  headers: string[],
): Promise<GoogleSpreadsheetWorksheet> {
  const existing = doc.sheetsByTitle[title];
  if (existing) {
    return existing;
  }
  return doc.addSheet({ title, headerValues: headers });
}
