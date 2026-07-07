import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { api } from "../services/authService";
import settingsService from "../services/settingsService";

function InvoiceView() {

  const { invoiceNumber } = useParams();

  const [invoice, setInvoice] = useState(null);
  const [schoolName, setSchoolName] = useState("");

  const invoiceRef = useRef();

  //////////////////////////////////////////////////////
  // FETCH INVOICE
  //////////////////////////////////////////////////////

  useEffect(() => {

    fetchInvoice();

    settingsService.getAll().then(s => {
      setSchoolName(s?.branding?.reportHeader || s?.school?.name || "");
    }).catch(() => {});

  }, []);

  const fetchInvoice = async () => {

    try {

      const data = await api.get(`/invoice/${invoiceNumber}`).then(r => r.data);

      setInvoice(data);

    } catch (error) {

      console.error(error);

    }

  };

  //////////////////////////////////////////////////////
  // DOWNLOAD PDF
  //////////////////////////////////////////////////////

  const downloadPDF = async () => {

    const element = invoiceRef.current;

    const canvas = await html2canvas(element, {
      scale: 2,
    });

    const data = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const imgProperties = pdf.getImageProperties(data);

    const pdfWidth = pdf.internal.pageSize.getWidth();

    const pdfHeight =
      (imgProperties.height * pdfWidth) /
      imgProperties.width;

    pdf.addImage(
      data,
      "PNG",
      0,
      0,
      pdfWidth,
      pdfHeight
    );

    pdf.save(`${invoiceNumber}.pdf`);

  };

  //////////////////////////////////////////////////////
  // LOADING
  //////////////////////////////////////////////////////

  if (!invoice) {

    return (

      <div className="min-h-screen flex items-center justify-center bg-white">

        <h1 className="text-3xl font-bold text-yd-navy">
          Loading Invoice...
        </h1>

      </div>

    );

  }

  //////////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////////

  return (

    <div className="min-h-screen bg-white flex">

      {/* SIDEBAR */}

      <div className="w-[240px] bg-white shadow-xl min-h-screen p-6 hidden md:block">

        <h1 className="text-5xl font-black leading-none text-yd-yellow">
          Yellow
          <br />
          Dot
        </h1>

        <p className="text-gray-400 mt-4">
          Premium Preschool CRM
        </p>

        <div className="mt-16 space-y-8">

          <div className="flex items-center gap-4 text-gray-600 font-semibold">
            🏠 Dashboard
          </div>

          <div className="flex items-center gap-4 text-gray-600 font-semibold">
            🎓 Students
          </div>

          <div className="flex items-center gap-4 text-gray-600 font-semibold">
            💳 Fees
          </div>

          <div className="flex items-center gap-4 text-yd-navy font-bold">
            📄 Invoices
          </div>

          <div className="flex items-center gap-4 text-gray-600 font-semibold">
            📊 Analytics
          </div>

        </div>

      </div>

      {/* MAIN */}

      <div className="flex-1 p-6 md:p-10">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10">

          <div>

            <h1 className="text-5xl font-black text-yd-navy">
              Invoice Preview
            </h1>

            <p className="text-gray-500 mt-3 text-lg">
              Premium invoice receipt
            </p>

          </div>

          <button
            onClick={downloadPDF}
            className="
              mt-6
              md:mt-0
              bg-yd-yellow
              hover:bg-yd-yellow-hover
              text-black
              px-8
              py-4
              rounded-3xl
              font-bold
              shadow-xl
              transition-all
            "
          >
            Download PDF
          </button>

        </div>

        {/* INVOICE CARD */}

        <div
          ref={invoiceRef}
          className="
            bg-white
            rounded-[40px]
            shadow-2xl
            p-8
            md:p-16
            max-w-5xl
            mx-auto
          "
        >

          {/* TOP */}

          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-10">

            <div>

              <h1 className="text-6xl font-black text-yd-navy">
                {schoolName}
              </h1>

              <p className="text-gray-500 text-2xl mt-4">
                Premium Preschool & Daycare
              </p>

            </div>

            <div className="text-left md:text-right">

              <p className="text-gray-400 mb-2">
                Invoice Number
              </p>

              <h2 className="text-2xl font-bold text-yd-navy">
                {invoice.Invoice_Number}
              </h2>

            </div>

          </div>

          {/* STUDENT */}

          <div className="grid md:grid-cols-2 gap-10 mt-20">

            <div>

              <p className="text-gray-400 mb-3">
                Student Name
              </p>

              <h2 className="text-4xl font-black text-yd-navy">
                {invoice.Student_Name}
              </h2>

            </div>

            <div>

              <p className="text-gray-400 mb-3">
                Status
              </p>

              <div
                className={`
                  inline-block
                  px-6
                  py-3
                  rounded-2xl
                  font-bold
                  text-lg
                  ${
                    invoice.Payment_Status === "Paid"
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }
                `}
              >
                {invoice.Payment_Status}
              </div>

            </div>

          </div>

          {/* FEES */}

          <div className="mt-20 border-t pt-14">

            <div className="grid grid-cols-2 mb-10">

              <h2 className="text-3xl font-black text-yd-navy">
                Fee Type
              </h2>

              <h2 className="text-3xl font-black text-yd-navy text-right">
                Amount
              </h2>

            </div>

            <div className="grid grid-cols-2 items-center">

              <p className="text-2xl text-yd-navy">
                {invoice.Fees_Type}
              </p>

              <p className="text-3xl font-black text-yd-navy text-right">
                ₹{invoice.Amount}
              </p>

            </div>

          </div>

          {/* TOTAL */}

          <div className="mt-20 border-t pt-14 grid md:grid-cols-2 gap-10">

            <div>

              <p className="text-gray-400 mb-4">
                Total Amount
              </p>

              <h1 className="text-6xl font-black text-yd-navy">
                ₹{invoice.Amount}
              </h1>

            </div>

            <div className="md:text-right">

              <p className="text-gray-400 mb-4">
                Billing Type
              </p>

              <h2 className="text-4xl font-black text-yd-navy">
                {invoice.Billing_Cycle}
              </h2>

            </div>

          </div>

          {/* FOOTER */}

          <div className="mt-24 border-t pt-10">

            <p className="text-center text-gray-400 text-lg">
              Thank you for choosing {schoolName}
            </p>

          </div>

        </div>

      </div>

    </div>

  );

}

export default InvoiceView;