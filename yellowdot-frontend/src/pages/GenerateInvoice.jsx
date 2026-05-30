import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../services/authService";

function GenerateInvoice() {

  // =========================
  // STATES
  // =========================

  const [students, setStudents] = useState([]);
  const [invoiceHistory, setInvoiceHistory] = useState([]);

  const [studentName, setStudentName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [feesType, setFeesType] = useState("");
  const [billingCycle, setBillingCycle] = useState("Monthly");

  const [amount, setAmount] = useState(0);
  const [gst, setGst] = useState(18);
  const [discount, setDiscount] = useState(0);

  const [notes, setNotes] = useState("");

  const [fatherWhatsApp, setFatherWhatsApp] = useState("");
  const [motherWhatsApp, setMotherWhatsApp] = useState("");

  const [paymentStatus, setPaymentStatus] = useState("Pending");

  const [durationFrom, setDurationFrom] = useState("");
  const [durationTo, setDurationTo] = useState("");

  // =========================
  // TOTAL
  // =========================

  const totalAmount =
    Number(amount) +
    (Number(amount) * Number(gst)) / 100 -
    Number(discount);

  // =========================
  // LOAD DATA
  // =========================

  useEffect(() => {

    generateInvoiceNumber();

    fetchStudents();

    fetchInvoices();

  }, []);

  // =========================
  // AUTO INVOICE NUMBER
  // =========================

  const generateInvoiceNumber = () => {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, "0");

    const random = Math.floor(100 + Math.random() * 900);

    setInvoiceNumber(`INV-${year}${month}-${random}`);

  };

  // =========================
  // FETCH STUDENTS
  // =========================

  const fetchStudents = async () => {

  try {

    const data = await api.get("/students").then(r => r.data);

    setStudents(data);

  } catch (error) {

    console.error(error);

  }

};
  // =========================
  // FETCH INVOICES
  // =========================

  const fetchInvoices = async () => {

    try {

      const res = await api.get("/api/invoices").then(r => r.data);

      setInvoiceHistory(res.invoices || []);

    } catch (error) {

      console.error(error);

    }

  };

  // =========================
  // AUTO FILL STUDENT
  // =========================

      const handleStudentChange = (e) => {

      const selectedName = e.target.value;

      setStudentName(selectedName);

      const selectedStudent = students.find(

        (student) =>
          student.Student_Name === selectedName

      );

      if (selectedStudent) {

        setFatherWhatsApp(
          selectedStudent.Father_WhatsApp || ""
        );

        setMotherWhatsApp(
          selectedStudent.Mother_WhatsApp || ""
        );

      }

    };

  // =========================
  // DURATION LOGIC
  // =========================

  const calculateDuration = (joinDate, studentClass) => {

    if (!joinDate) return;

    const start = new Date(joinDate);

    const end = new Date(start);

    // DAYCARE
    if (studentClass === "Daycare") {

      if (billingCycle === "Monthly") {

        end.setMonth(end.getMonth() + 1);

        end.setDate(end.getDate() - 1);

      }

      else if (billingCycle === "Quarterly") {

        end.setMonth(end.getMonth() + 3);

        end.setDate(end.getDate() - 1);

      }

    }

    // PRESCHOOL
    else {

      const currentYear = start.getFullYear();

      const nextYear = currentYear + 1;

      end.setFullYear(nextYear, 2, 31);

    }

    setDurationFrom(
      start.toISOString().split("T")[0]
    );

    setDurationTo(
      end.toISOString().split("T")[0]
    );

  };

  // =========================
  // PDF
  // =========================

  const generatePDF = () => {

    const doc = new jsPDF();

    doc.setFontSize(22);

    doc.text("Yellow Dot Preschool & Daycare", 20, 20);

    doc.setFontSize(14);

    doc.text(`Invoice Number: ${invoiceNumber}`, 20, 40);

    autoTable(doc, {

      startY: 60,

      body: [

        ["Student", studentName],

        ["Invoice Date", invoiceDate],

        ["Fees Type", feesType],

        ["Billing Cycle", billingCycle],

        ["Duration From", durationFrom],

        ["Duration To", durationTo],

        ["Amount", `₹${amount}`],

        ["GST", `${gst}%`],

        ["Discount", `₹${discount}`],

        ["Total", `₹${totalAmount}`],

      ],

    });

    doc.save(`${invoiceNumber}.pdf`);

  };

  // =========================
  // PRINT
  // =========================

  const printInvoice = () => {

    window.print();

  };

// ==================// saveInvoice// =========================
const saveInvoice = async () => {

  try {

    const selectedStudent = students.find(

      (student) =>
        student.Student_Name === studentName

    );

    const data = await api.post("/save-invoice", {

          invoiceNumber,

          studentId:
            selectedStudent?.Student_ID || "",

          studentName,

          studentClass:
            selectedStudent?.Class || "",

          feesType,

          billingCycle,

          durationFrom,

          durationTo,

          invoiceDate,

          amount,

          gst,

          discount,

          totalAmount,

          paymentStatus,

          fatherWhatsApp,

          motherWhatsApp,

          notes,

        }).then(r => r.data);

            const toast = document.createElement("div");

                toast.innerHTML = `
                  <div style="
                    position: fixed;
                    top: 30px;
                    right: 30px;
                    background: linear-gradient(135deg, #08153D, #102A72);
                    color: white;
                    padding: 22px 28px;
                    border-radius: 24px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
                    z-index: 9999;
                    min-width: 320px;
                    font-family: sans-serif;
                    animation: slideIn 0.4s ease;
                  ">
                    
                    <div style="
                      display:flex;
                      align-items:center;
                      gap:16px;
                    ">
                      
                      <div style="
                        width:56px;
                        height:56px;
                        border-radius:18px;
                        background:#FFD600;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:28px;
                      ">
                        ✅
                      </div>

                      <div>
                        <div style="
                          font-size:22px;
                          font-weight:700;
                          margin-bottom:4px;
                        ">
                          Invoice Saved
                        </div>

                        <div style="
                          opacity:0.8;
                          font-size:14px;
                        ">
                          Successfully added to Yellow Dot CRM
                        </div>
                      </div>

                    </div>
                  </div>

                  <style>
                    @keyframes slideIn {
                      from {
                        transform: translateX(100px);
                        opacity:0;
                      }
                      to {
                        transform: translateX(0);
                        opacity:1;
                      }
                    }
                  </style>
                `;

        document.body.appendChild(toast);

        setTimeout(() => {
          toast.remove();
        }, 3000);

  } catch (error) {

    console.error(error);

    const errorToast = document.createElement("div");

          errorToast.innerHTML = `
            <div style="
              position: fixed;
              top: 30px;
              right: 30px;
              background: #ff4d4f;
              color: white;
              padding: 22px 28px;
              border-radius: 24px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.25);
              z-index: 9999;
              min-width: 320px;
              font-family: sans-serif;
            ">
              
              <div style="
                display:flex;
                align-items:center;
                gap:16px;
              ">
                
                <div style="
                  width:56px;
                  height:56px;
                  border-radius:18px;
                  background:white;
                  color:#ff4d4f;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-size:28px;
                ">
                  ❌
                </div>

                <div>
                  <div style="
                    font-size:22px;
                    font-weight:700;
                    margin-bottom:4px;
                  ">
                    Save Failed
                  </div>

                  <div style="
                    opacity:0.9;
                    font-size:14px;
                  ">
                    Something went wrong while saving invoice
                  </div>
                </div>

              </div>
            </div>
          `;

      document.body.appendChild(errorToast);

      setTimeout(() => {
        errorToast.remove();
      }, 3000);

        }

};


  // ==================// WHATSAPP// =========================

  const shareWhatsApp = (phoneNumber) => {

    if (!phoneNumber) {

      alert("WhatsApp number not available");

      return;

    }

    const message = `
🐣 Yellow Dot Preschool & Daycare

Hello Parent,

Your fee invoice has been generated successfully.

🧾 Invoice Number:
${invoiceNumber}

👦 Student:
${studentName}

💳 Fees Type:
${feesType}

📅 Billing:
${billingCycle}

📆 Duration:
${durationFrom} to ${durationTo}

💰 Total:
₹${totalAmount}

Thank you,
Yellow Dot Preschool & Daycare
`;

    const whatsappURL =
      `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`;

    window.open(whatsappURL, "_blank");

  };

  return (

    <div className="flex bg-white min-h-screen">

      <Sidebar />

      {/* MAIN */}

      <div className="flex-1 p-10">

        {/* HEADER */}

        <div className="flex justify-between items-center mb-10">

          <div>

            <p className="text-gray-400 mb-2">
              Yellow Dot CRM
            </p>

            <h1 className="text-6xl font-black text-[#08153D]">
              Generate Invoice
            </h1>

          </div>

          <button

                  onClick={saveInvoice}

                  className=" bg-yd-yellow px-8 py-4 rounded-3xl font-bold shadow-xl hover:scale-105 duration-300"
                >

                  Save Invoice

                </button>

        </div>

        {/* CONTENT */}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* LEFT */}

          <div className="xl:col-span-2 bg-white rounded-[40px] p-8 shadow-sm">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* STUDENT */}

                  <div>

                    <label className="text-sm font-bold text-[#5B647A]">
                      Student Name
                    </label>

                    <select
                      value={studentName}
                      onChange={handleStudentChange}
                      className="w-full mt-2 h-16 rounded-2xl px-5 bg-[#F8F8F8] outline-none"
                    >

                      <option value="">
                        Select Student
                      </option>

                      {
                        students && students.length > 0 ? (

                          students.map((student, index) => (

                            <option
                              key={index}
                              value={student.Student_Name}
                            >
                              {student.Student_Name}
                            </option>

                          ))

                        ) : (

                          <option>
                            No Students Found
                          </option>

                        )
                      }

                    </select>

                  </div>

              {/* INVOICE */}

              <div>

                <label className="font-bold text-sm">
                  Invoice Number
                </label>

                <input
                  value={invoiceNumber}
                  readOnly
                  className="w-full mt-2 h-16 rounded-2xl px-5 bg-white"
                />

              </div>

              {/* DATE */}

              <div>

                <label className="font-bold text-sm">
                  Invoice Date
                </label>

                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) =>
                    setInvoiceDate(e.target.value)
                  }
                  className="w-full mt-2 h-16 rounded-2xl px-5 bg-[#F8F8F8]"
                />

              </div>

              {/* FEES */}

              <div>

                <label className="font-bold text-sm">
                  Fees Type
                </label>

                <select
                  value={feesType}
                  onChange={(e) =>
                    setFeesType(e.target.value)
                  }
                  className="w-full mt-2 h-16 rounded-2xl px-5 bg-[#F8F8F8]"
                >

                  <option>Select Fees Type</option>

                  <option>Tuition Fees</option>

                  <option>Daycare Fees</option>

                  <option>Transport Fees</option>

                  <option>Meal Fees</option>

                </select>

              </div>

              {/* AMOUNT */}

              <div>

                <label className="font-bold text-sm">
                  Amount
                </label>

                <input
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value)
                  }
                  className="w-full mt-2 h-16 rounded-2xl px-5 bg-[#F8F8F8]"
                />

              </div>

              {/* GST */}

              <div>

                <label className="font-bold text-sm">
                  GST %
                </label>

                <input
                  value={gst}
                  onChange={(e) =>
                    setGst(e.target.value)
                  }
                  className="w-full mt-2 h-16 rounded-2xl px-5 bg-[#F8F8F8]"
                />

              </div>

              {/* DISCOUNT */}

              <div>

                <label className="font-bold text-sm">
                  Discount
                </label>

                <input
                  value={discount}
                  onChange={(e) =>
                    setDiscount(e.target.value)
                  }
                  className="w-full mt-2 h-16 rounded-2xl px-5 bg-[#F8F8F8]"
                />

              </div>

            </div>

            {/* BILLING */}

            <div className="mt-8">

              <label className="font-bold text-sm">
                Billing Cycle
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">

                {
                  ["Monthly", "Quarterly", "Not Applicable"]
                  .map((item) => (

                    <button
                      key={item}
                      onClick={() =>
                        setBillingCycle(item)
                      }
                      className={`
                        h-16 rounded-2xl font-bold
                        ${
                          billingCycle === item
                            ? "bg-yd-yellow"
                            : "bg-[#F8F8F8]"
                        }
                      `}
                    >
                      {item}
                    </button>

                  ))
                }

              </div>

            </div>

            {/* DURATION */}

            <div className="grid grid-cols-2 gap-6 mt-8">

              <div>

                <label className="font-bold text-sm">
                  Duration From
                </label>

                <input
                  type="date"
                  value={durationFrom}
                  onChange={(e) =>
                    setDurationFrom(e.target.value)
                  }
                  className="w-full mt-2 h-16 rounded-2xl px-5 bg-[#F8F8F8]"
                />

              </div>

              <div>

                <label className="font-bold text-sm">
                  Duration To
                </label>

                <input
                  type="date"
                  value={durationTo}
                  onChange={(e) =>
                    setDurationTo(e.target.value)
                  }
                  className="w-full mt-2 h-16 rounded-2xl px-5 bg-[#F8F8F8]"
                />

              </div>

            </div>

            {/* NOTES */}

            <div className="mt-8">

              <label className="font-bold text-sm">
                Notes
              </label>

              <textarea
                rows="5"
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                className="w-full mt-2 rounded-3xl p-5 bg-[#F8F8F8]"
              />

            </div>

          </div>

          {/* RIGHT */}

          <div className="space-y-6">

            {/* TOTAL */}

            <div className="bg-white p-8 rounded-[40px]">

              <p className="text-gray-500">
                Total Amount
              </p>

              <h1 className="text-6xl font-black text-[#08153D] mt-4">
                ₹{totalAmount}
              </h1>

            </div>

            {/* ACTIONS */}

            <div className="bg-white p-6 rounded-[40px] space-y-4">

              <button
                onClick={generatePDF}
                className="w-full h-16 rounded-2xl bg-yd-yellow font-bold"
              >
                Generate PDF
              </button>

              <button
                onClick={printInvoice}
                className="w-full h-16 rounded-2xl bg-[#08153D] text-white font-bold"
              >
                Print Invoice
              </button>

              <button
                onClick={() =>
                  shareWhatsApp(fatherWhatsApp)
                }
                className="w-full h-16 rounded-2xl bg-green-500 text-white font-bold"
              >
                WhatsApp Father
              </button>

              <button
                onClick={() =>
                  shareWhatsApp(motherWhatsApp)
                }
                className="w-full h-16 rounded-2xl bg-green-600 text-white font-bold"
              >
                WhatsApp Mother
              </button>

            </div>

          </div>

        </div>

        {/* HISTORY */}

        <div className="bg-white rounded-[40px] p-8 mt-10">

          <h2 className="text-3xl font-black text-[#08153D] mb-6">
            Invoice History
          </h2>

          <div className="overflow-auto">

            <table className="w-full">

              <thead>

                <tr className="border-b">

                  <th className="text-left p-4">
                    Invoice
                  </th>

                  <th className="text-left p-4">
                    Student
                  </th>

                  <th className="text-left p-4">
                    Amount
                  </th>

                  <th className="text-left p-4">
                    Status
                  </th>

                </tr>

              </thead>

              <tbody>

                {
                  invoiceHistory.map((invoice, index) => (

                    <tr
                      key={index}
                      className="border-b"
                    >

                      <td className="p-4">
                        {invoice.Invoice_Number}
                      </td>

                      <td className="p-4">
                        {invoice.Student_Name}
                      </td>

                      <td className="p-4">
                        ₹{invoice.Total_Amount}
                      </td>

                      <td className="p-4">
                        {invoice.Payment_Status}
                      </td>

                    </tr>

                  ))
                }

              </tbody>

            </table>

          </div>

        </div>

      </div>

    </div>

  );

}

export default GenerateInvoice;