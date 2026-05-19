const { google } = require("googleapis");
const { SHEETS, STUDENT_COLS } = require("./config/sheetsConfig");

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

async function getStudents() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEETS.STUDENTS,   // "Students!A:R" from sheetsConfig
  });

  const rows = response.data.values;

  if (!rows || rows.length === 0) {
    return [];
  }

  const C = STUDENT_COLS;
  return rows.slice(1).map((row) => ({
    Student_ID:        row[C.STUDENT_ID]      || "",
    Student_Name:      row[C.STUDENT_NAME]    || "",
    DOB:               row[C.DOB]             || "",
    Class:             row[C.CLASS]           || "",
    Join_Date:         row[C.JOIN_DATE]       || "",
    Gender:            row[C.GENDER]          || "",
    Father_Name:       row[C.FATHER_NAME]     || "",
    Father_WhatsApp:   row[C.FATHER_WHATSAPP] || "",
    Father_Email:      row[C.FATHER_EMAIL]    || "",
    Mother_Name:       row[C.MOTHER_NAME]     || "",
    Mother_WhatsApp:   row[C.MOTHER_WHATSAPP] || "",
    Mother_Email:      row[C.MOTHER_EMAIL]    || "",
    Status:            row[C.STATUS]          || "",
    Center:            row[C.CENTER]          || "",
    Address:           row[C.ADDRESS]         || "",
    Blood_Group:       row[C.BLOOD_GROUP]     || "",
    Medical_Notes:     row[C.MEDICAL_NOTES]   || "",
    Notes:             row[C.NOTES]           || "",
    // Legacy camelCase aliases (keep for existing controllers)
    student_id:        row[C.STUDENT_ID]      || "",
    student_name:      row[C.STUDENT_NAME]    || "",
    father_email:      row[C.FATHER_EMAIL]    || "",
    mother_email:      row[C.MOTHER_EMAIL]    || "",
    father_whatsapp:   row[C.FATHER_WHATSAPP] || "",
    mother_whatsapp:   row[C.MOTHER_WHATSAPP] || "",
    status:            row[C.STATUS]          || "",
    center:            row[C.CENTER]          || "",
    class:             row[C.CLASS]           || "",
  }));
}

module.exports = {
  getStudents,
  sheets,
  SPREADSHEET_ID,
};