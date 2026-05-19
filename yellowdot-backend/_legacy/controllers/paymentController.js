const {
  sheets,
  SPREADSHEET_ID,
} = require("../services/googleSheetsService");

const generatePaymentId = require(
  "../utils/generatePaymentId"
);

const recordPayment = async (req, res) => {
  try {
    const {
      invoiceNumber,
      studentName,
      paymentAmount,
      paymentMode,
      transactionId,
      notes,
      paymentDate,
    } = req.body;

    const paymentId = generatePaymentId();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Payments!A:I",
      valueInputOption: "USER_ENTERED",

      requestBody: {
        values: [
          [
            paymentId,
            invoiceNumber,
            studentName,
            paymentAmount,
            paymentMode,
            transactionId,
            paymentDate,
            notes,
            new Date().toLocaleString(),
          ],
        ],
      },
    });

    res.json({
      success: true,
      message: "Payment Recorded",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Record Payment",
    });
  }
};

module.exports = {
  recordPayment,
};