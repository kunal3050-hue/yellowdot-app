const { sheets, spreadsheetId } = require("../services/googleSheetsService");
const { SHEETS } = require("../config/sheetsConfig");

const addStudent = async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      dob,
      studentClass,
      joinDate,
      gender,
      fatherName,
      fatherWhatsApp,
      fatherEmail,
      motherName,
      motherWhatsApp,
      motherEmail,
      status,
      center,
      address,
      bloodGroup,
      medicalNotes,
      notes,
    } = req.body;

    // Columns A:R (18 columns) — matches Students!A:R in sheetsConfig
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range:            SHEETS.STUDENTS,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          studentId    || "",
          studentName  || "",
          dob          || "",
          studentClass || "",
          joinDate     || "",
          gender       || "",
          fatherName   || "",
          fatherWhatsApp || "",
          fatherEmail  || "",
          motherName   || "",
          motherWhatsApp || "",
          motherEmail  || "",
          status       || "active",
          center       || "",
          address      || "",
          bloodGroup   || "",
          medicalNotes || "",
          notes        || "",
        ]],
      },
    });

    console.log(`[STUDENT] ADDED  id=${studentId}  name=${studentName}`);
    res.status(200).json({ success: true, message: "Student added successfully." });

  } catch (error) {
    console.error("[STUDENT] addStudent error:", error.message);
    res.status(500).json({ success: false, message: "Error adding student." });
  }
};

module.exports = { addStudent };
