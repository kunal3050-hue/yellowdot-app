import { useEffect, useRef, useState } from "react";

import { useParams } from "react-router-dom";

import jsPDF from "jspdf";

import html2canvas from "html2canvas";

import { api } from "../services/authService";

function InvoiceView() {

  const { invoiceNumber } = useParams();

  const [invoice, setInvoice] = useState(null);

  const invoiceRef = useRef();

  // =========================
  // FETCH INVOICE
  // =========================

  const fetchInvoice = async () => {

    try {

      const data = await api.get(`/invoice/${invoiceNumber}`).then(r => r.data);

      setInvoice(data);

    } catch (error) {

      console.log(error);

    }

  };

  useEffect(() => {

    fetchInvoice();

  }, []);

  // =========================
  // DOWNLOAD PDF
  // =========================

    const downloadPDF = async () => {

    const input = invoiceRef.current;

    const canvas = await html2canvas(input);

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();

    const pdfHeight =
      (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(
      imgData,
      "PNG",
      0,
      0,
      pdfWidth,
      pdfHeight
    );

    pdf.save(`${invoice.Invoice_Number}.pdf`);

  };

  if (!invoice) {

    return (
      <div className="p-10">
        Loading...
      </div>
    );

  }

  return (

    <div className="min-h-screen bg-[#F4F7FE] p-10">

      {/* TOP BAR */}

      <div className="
        flex
        items-center
        justify-between
        mb-8
      ">

        <div>

          <h1 className="
            text-5xl
            font-black
            text-yd-navy
          ">
            Invoice Preview
          </h1>

          <p className="text-gray-500 mt-2">
            Premium invoice receipt
          </p>

        </div>

        <button
            onClick={downloadPDF}
            className="yellow-btn px-8 py-4 text-lg font-bold"
          >
            Download PDF
        </button>

      </div>

      {/* INVOICE */}

      <div
        ref={invoiceRef}
        className="          premium-card          max-w-5xl          mx-auto          p-16          bg-white        ">

        {/* HEADER */}

        <div className="
          flex
          justify-between
          items-start
          mb-16
        ">

          <div>

            <h1 className="
              text-6xl
              font-black
              text-yd-navy
            ">
              Yellow Dot
            </h1>

            <p className="text-gray-500 mt-3 text-xl">
              Premium Preschool & Daycare
            </p>

          </div>

          <div className="text-right">

            <p className="text-gray-400 mb-2">
              Invoice Number
            </p>

            <h2 className="
              text-2xl
              font-bold
            ">
              {invoice.Invoice_Number}
            </h2>

          </div>

        </div>

        {/* STUDENT */}

        <div className="
          grid
          grid-cols-2
          gap-10
          mb-16
        ">

          <div>

            <p className="text-gray-400 mb-3">
              Student Name
            </p>

            <h2 className="
              text-4xl
              font-black
              text-yd-navy
            ">
              {invoice.Student_Name}
            </h2>

          </div>

          <div>

            <p className="text-gray-400 mb-3">
              Status
            </p>

            <div
                className={`inline-block px-5 py-3 rounded-2xl font-bold ${
                  invoice.Payment_Status === "Paid"
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {invoice.Payment_Status}
              </div>

          </div>

        </div>

        {/* FEES */}

        <div className="
          border-t
          border-b
          py-10
          mb-10
        ">

          <div className="
            flex
            justify-between
            text-2xl
            mb-6
          ">

            <p className="font-semibold">
              Fee Type
            </p>

            <p className="font-semibold">
              Amount
            </p>

          </div>

          <div className="
            flex
            justify-between
            text-xl
          ">

            <p>
              {invoice.Fees_Type || "Fees"}
            </p>

            <p className="font-bold">
              ₹{invoice.Total_Amount}
            </p>

          </div>

        </div>

        {/* TOTAL */}

        <div className="
          flex
          justify-between
          items-center
        ">

          <div>

            <p className="text-gray-400">
              Total Amount
            </p>

            <h1 className="
              text-6xl
              font-black
              text-yd-navy
            ">
              ₹{invoice.Total_Amount}
            </h1>

          </div>

          <div className="text-right">

            <p className="text-gray-400 mb-2">
              Billing Type
            </p>

            <h2 className="
              text-2xl
              font-bold
            ">
              {invoice.Billing_Cycle || "—"}
            </h2>

          </div>

        </div>

      </div>

    </div>

  );

}

export default InvoiceView;