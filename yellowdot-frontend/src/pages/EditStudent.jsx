import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/authService";

function EditStudent() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    student_name: "",
    dob: "",
    class: "",
    join_date: "",
    gender: "",
    center: "",

    father_name: "",
    father_whatsapp: "",
    father_email: "",

    mother_name: "",
    mother_whatsapp: "",
    mother_email: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchStudent();
  }, []);

  const fetchStudent = async () => {
    try {
      const response = await api.get(`/students/${id}`);
      const data = response.data;

      setFormData({
        student_name:
          data.Student_Name || "",

        dob: formatDateForInput(
          data.DOB
        ),

        class: data.Class || "",

        join_date: formatDateForInput(
          data.Join_Date
        ),

        gender: data.Gender || "",
        center: data.Center || "",

        father_name:
          data.Father_Name || "",

        father_whatsapp:
          data.Father_WhatsApp || "",

        father_email:
          data.Father_Email || "",

        mother_name:
          data.Mother_Name || "",

        mother_whatsapp:
          data.Mother_WhatsApp || "",

        mother_email:
          data.Mother_Email || "",
      });

      setLoading(false);
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  };

  const formatDateForInput = (
    dateString
  ) => {
    if (!dateString) return "";

    const date = new Date(dateString);

    return date
      .toISOString()
      .split("T")[0];
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]:
        e.target.value,
    });
  };

  const validate = () => {
    let newErrors = {};

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const phoneRegex =
      /^[0-9]{10}$/;

    if (
      formData.father_email &&
      !emailRegex.test(
        formData.father_email
      )
    ) {
      newErrors.father_email =
        "Invalid Email";
    }

    if (
      formData.mother_email &&
      !emailRegex.test(
        formData.mother_email
      )
    ) {
      newErrors.mother_email =
        "Invalid Email";
    }

    if (
      formData.father_whatsapp &&
      !phoneRegex.test(
        formData.father_whatsapp
      )
    ) {
      newErrors.father_whatsapp =
        "Invalid WhatsApp Number";
    }

    if (
      formData.mother_whatsapp &&
      !phoneRegex.test(
        formData.mother_whatsapp
      )
    ) {
      newErrors.mother_whatsapp =
        "Invalid WhatsApp Number";
    }

    setErrors(newErrors);

    return (
      Object.keys(newErrors).length ===
      0
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const response = await api.put(`/update-student/${id}`, formData);
      const data = response.data;

      if (data.success) {
        alert(
          "Student Updated Successfully!"
        );

        navigate("/students");
      } else {
        alert(
          "Failed To Update Student"
        );
      }
    } catch (error) {
      console.log(error);

      alert("Server Error");
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-4xl font-bold">
        Loading Student...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* SIDEBAR */}

      <div className="w-[220px] bg-white border-r border-gray-100 p-6 hidden md:flex flex-col justify-between">

        <div>
          <h1 className="text-6xl font-black text-yellow-500 leading-none tracking-tight">
            Yellow Dot
          </h1>

          <div className="mt-20 space-y-4">

            <button
              onClick={() =>
                navigate("/")
              }
              className="w-full text-left px-5 py-4 rounded-2xl text-gray-600 hover:bg-yellow-50 transition-all"
            >
              Dashboard
            </button>

            <button className="w-full text-left px-5 py-4 rounded-2xl bg-yellow-400 text-white font-bold shadow-lg shadow-yellow-200">
              Students
            </button>

            <button className="w-full text-left px-5 py-4 rounded-2xl text-gray-600 hover:bg-yellow-50 transition-all">
              Attendance
            </button>

            <button className="w-full text-left px-5 py-4 rounded-2xl text-gray-600 hover:bg-yellow-50 transition-all">
              Fees
            </button>

          </div>
        </div>

        <div className="bg-yellow-50 rounded-3xl p-6">
          <p className="text-sm text-gray-500">
            Yellow Dot CRM
          </p>

          <h3 className="text-2xl font-black text-[#0F172A] mt-2">
            Premium Preschool Management
          </h3>
        </div>
      </div>

      {/* MAIN */}

      <div className="flex-1 p-4 md:p-6 overflow-y-auto max-w-[1600px] mx-auto w-full">

        {/* TOP */}

        <div className="flex justify-between items-center mb-8">

          <div>
            <p className="text-gray-400 font-medium">
              Yellow Dot CRM
            </p>

            <h1 className="text-5xl font-black text-[#0F172A] mt-2">
              Edit Student
            </h1>

            <p className="text-gray-500 mt-3 text-base">
              Update premium student profile
            </p>
          </div>

          <button
            onClick={() =>
              navigate("/students")
            }
            className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100 font-bold hover:shadow-lg transition-all"
          >
            Back
          </button>

        </div>

        {/* HERO */}

        <div className="bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-300 rounded-[32px] p-6 md:p-6 text-white shadow-2xl shadow-yellow-100 mb-8">

          <div className="flex items-center gap-6">

            <div className="w-16 h-16 rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center text-5xl font-black shadow-xl">
              ✏️
            </div>

            <div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                {formData.student_name ||
                  "Edit Student"}
              </h2>

              <p className="text-white/90 text-xl mt-2">
                Student ID: {id}
              </p>

              <div className="flex gap-3 mt-5">

                <span className="px-5 py-2 rounded-2xl bg-white/20 text-[11px] font-semibold backdrop-blur-md">
                  {formData.class ||
                    "Class"}
                </span>

                <span className="px-5 py-2 rounded-2xl bg-white/20 text-[11px] font-semibold backdrop-blur-md">
                  {formData.center ||
                    "Center"}
                </span>

              </div>
            </div>

          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          {/* STUDENT INFO */}

          <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">

            <h2 className="text-3xl font-black text-[#0F172A] mb-8">
              Student Information
            </h2>

            <div className="grid md:grid-cols-2 gap-6">

              <InputField
                label="Student Name"
                name="student_name"
                value={
                  formData.student_name
                }
                onChange={
                  handleChange
                }
              />

              <InputField
                label="Date of Birth"
                type="date"
                name="dob"
                value={formData.dob}
                onChange={
                  handleChange
                }
              />

              <SelectField
                label="Class"
                name="class"
                value={
                  formData.class
                }
                onChange={
                  handleChange
                }
                options={[
                  "Playgroup",
                  "Nursery",
                  "Junior K.G.",
                  "Senior K.G.",
                  "Daycare",
                ]}
              />

              <SelectField
                label="Gender"
                name="gender"
                value={
                  formData.gender
                }
                onChange={
                  handleChange
                }
                options={[
                  "Male",
                  "Female",
                  "Others",
                ]}
              />

              <InputField
                label="Center"
                name="center"
                value={
                  formData.center
                }
                onChange={
                  handleChange
                }
              />

              <InputField
                label="Join Date"
                type="date"
                name="join_date"
                value={
                  formData.join_date
                }
                onChange={
                  handleChange
                }
              />

            </div>
          </div>

          {/* FATHER */}

          <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">

            <h2 className="text-3xl font-black text-[#0F172A] mb-8">
              Father Details
            </h2>

            <div className="grid md:grid-cols-3 gap-6">

              <InputField
                label="Father Name"
                name="father_name"
                value={
                  formData.father_name
                }
                onChange={
                  handleChange
                }
              />

              <InputField
                label="Father WhatsApp"
                name="father_whatsapp"
                value={
                  formData.father_whatsapp
                }
                onChange={
                  handleChange
                }
                error={
                  errors.father_whatsapp
                }
              />

              <InputField
                label="Father Email"
                name="father_email"
                value={
                  formData.father_email
                }
                onChange={
                  handleChange
                }
                error={
                  errors.father_email
                }
              />

            </div>
          </div>

          {/* MOTHER */}

          <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">

            <h2 className="text-3xl font-black text-[#0F172A] mb-8">
              Mother Details
            </h2>

            <div className="grid md:grid-cols-3 gap-6">

              <InputField
                label="Mother Name"
                name="mother_name"
                value={
                  formData.mother_name
                }
                onChange={
                  handleChange
                }
              />

              <InputField
                label="Mother WhatsApp"
                name="mother_whatsapp"
                value={
                  formData.mother_whatsapp
                }
                onChange={
                  handleChange
                }
                error={
                  errors.mother_whatsapp
                }
              />

              <InputField
                label="Mother Email"
                name="mother_email"
                value={
                  formData.mother_email
                }
                onChange={
                  handleChange
                }
                error={
                  errors.mother_email
                }
              />

            </div>
          </div>

          {/* BUTTON */}

          <div className="flex justify-end">

            <button
              type="submit"
              className="bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500 text-white px-12 py-5 rounded-3xl font-black text-base shadow-2xl shadow-yellow-200 transition-all hover:scale-105"
            >
              Update Student
            </button>

          </div>

        </form>
      </div>
    </div>
  );
}

function InputField({
  label,
  error,
  ...props
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 mb-3 uppercase tracking-wide">
        {label}
      </label>

      <input
        {...props}
        className={`w-full bg-white px-4 py-3.5 rounded-2xl outline-none border-2 transition-all text-base font-medium ${
          error
            ? "border-red-400"
            : "border-transparent focus:border-yellow-400"
        }`}
      />

      {error && (
        <p className="text-red-500 text-sm mt-2 font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectField({
  label,
  options,
  ...props
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 mb-3 uppercase tracking-wide">
        {label}
      </label>

      <select
        {...props}
        className="w-full bg-white px-4 py-3.5 rounded-2xl outline-none border-2 border-transparent focus:border-yellow-400 transition-all text-base font-medium"
      >
        <option value="">
          Select {label}
        </option>

        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default EditStudent;