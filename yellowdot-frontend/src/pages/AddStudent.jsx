import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { api } from "../services/authService";
import { PLATFORM_NAME } from "../config/environment";

function AddStudent() {
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState({
    student_name: "",
    dob: "",
    class: "",
    gender: "",
    center: "",
    join_date: "",

    father_name: "",
    father_whatsapp: "",
    father_email: "",

    mother_name: "",
    mother_whatsapp: "",
    mother_email: "",
  });

  const [studentPhoto, setStudentPhoto] = useState(null);
  const [fatherPhoto, setFatherPhoto] = useState(null);
  const [motherPhoto, setMotherPhoto] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateEmail = (email) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const validatePhone = (phone) => {
    return /^[0-9]{10}$/.test(phone);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !validateEmail(formData.father_email) ||
      !validateEmail(formData.mother_email)
    ) {
      alert("Please enter valid email addresses");
      return;
    }

    if (
      !validatePhone(formData.father_whatsapp) ||
      !validatePhone(formData.mother_whatsapp)
    ) {
      alert("Please enter valid 10 digit WhatsApp numbers");
      return;
    }

    try {
      const response = await api.post("/add-student", formData);
      const data = response.data;

      if (data.success) {
        setShowSuccess(true);

        setFormData({
          student_name: "",
          dob: "",
          class: "",
          gender: "",
          center: "",
          join_date: "",

          father_name: "",
          father_whatsapp: "",
          father_email: "",

          mother_name: "",
          mother_whatsapp: "",
          mother_email: "",
        });
      } else {
        alert("Error adding student");
      }
    } catch (error) {
      console.log(error);
      alert("Server Error");
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <Sidebar />

      <div className="flex-1 ml-[280px] p-8">
        {/* HEADER */}

        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-gray-400 text-sm font-medium mb-1">
              {PLATFORM_NAME}
            </p>

            <h1 className="text-5xl font-black text-gray-900 tracking-tight">
              Add Student
            </h1>

            <p className="text-gray-500 mt-3 text-lg">
              Create premium student profile
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400">Admin</p>
              <p className="font-bold text-gray-800">Kunal</p>
            </div>
          </div>
        </div>

        {/* HERO */}

        <div className="bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-[40px] p-10 shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-lg border border-white/30 flex items-center justify-center text-white text-5xl shadow-lg">
                +
              </div>

              <div>
                <h2 className="text-5xl font-black text-white mb-2">
                  New Student
                </h2>

                <p className="text-white/80 text-lg">
                  Admission & Parent Information
                </p>

                <div className="flex gap-3 mt-5">
                  <div className="bg-white/20 px-4 py-2 rounded-2xl text-white text-sm">
                    Premium CRM
                  </div>

                  <div className="bg-white/20 px-4 py-2 rounded-2xl text-white text-sm">
                    {PLATFORM_NAME}
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex gap-4">
              <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-3xl px-6 py-5">
                <p className="text-white/70 text-sm">Student ID</p>
                <h3 className="text-3xl font-black text-white">AUTO</h3>
              </div>

              <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-3xl px-6 py-5">
                <p className="text-white/70 text-sm">Status</p>
                <h3 className="text-3xl font-black text-white">New</h3>
              </div>
            </div>
          </div>
        </div>

        {/* FORM */}

        <form onSubmit={handleSubmit}>
          {/* PHOTO SECTION */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <PhotoUpload
              title="Student Photo"
              image={studentPhoto}
              onChange={(e) =>
                setStudentPhoto(URL.createObjectURL(e.target.files[0]))
              }
            />

            <PhotoUpload
              title="Father Photo"
              image={fatherPhoto}
              onChange={(e) =>
                setFatherPhoto(URL.createObjectURL(e.target.files[0]))
              }
            />

            <PhotoUpload
              title="Mother Photo"
              image={motherPhoto}
              onChange={(e) =>
                setMotherPhoto(URL.createObjectURL(e.target.files[0]))
              }
            />
          </div>

          {/* STUDENT INFO */}

          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-8">
              Student Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <InputField
                label="Student Name"
                name="student_name"
                value={formData.student_name}
                onChange={handleChange}
              />

              <InputField
                label="Date of Birth"
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
              />

              <SelectField
                label="Class"
                name="class"
                value={formData.class}
                onChange={handleChange}
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
                value={formData.gender}
                onChange={handleChange}
                options={["Male", "Female", "Others"]}
              />

              <InputField
                label="Center"
                name="center"
                value={formData.center}
                onChange={handleChange}
              />

              <InputField
                label="Join Date"
                type="date"
                name="join_date"
                value={formData.join_date}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* FATHER DETAILS */}

          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-8">
              Father Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <InputField
                label="Father Name"
                name="father_name"
                value={formData.father_name}
                onChange={handleChange}
              />

              <InputField
                label="Father WhatsApp"
                name="father_whatsapp"
                value={formData.father_whatsapp}
                onChange={handleChange}
              />

              <InputField
                label="Father Email"
                name="father_email"
                value={formData.father_email}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* MOTHER DETAILS */}

          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-8">
              Mother Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <InputField
                label="Mother Name"
                name="mother_name"
                value={formData.mother_name}
                onChange={handleChange}
              />

              <InputField
                label="Mother WhatsApp"
                name="mother_whatsapp"
                value={formData.mother_whatsapp}
                onChange={handleChange}
              />

              <InputField
                label="Mother Email"
                name="mother_email"
                value={formData.mother_email}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* BUTTON */}

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-yellow-400 hover:bg-yellow-500 text-white px-10 py-5 rounded-3xl font-black text-lg shadow-xl hover:scale-105 transition-all duration-300"
            >
              Save Student
            </button>
          </div>
        </form>
      </div>

      {/* SUCCESS MODAL */}

      {showSuccess && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-[90%] max-w-md rounded-[40px] p-10 shadow-2xl">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-8">
              <span className="text-5xl">✅</span>
            </div>

            <h2 className="text-4xl font-black text-center text-gray-900 mb-4">
              Student Added
            </h2>

            <p className="text-center text-gray-500 text-lg mb-8">
              Student profile created successfully.
            </p>

            <button
              onClick={() => setShowSuccess(false)}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-white py-5 rounded-3xl font-black text-xl transition-all duration-300"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-500 mb-3">
        {label}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full bg-white border border-gray-100 rounded-3xl px-6 py-5 outline-none focus:border-yellow-400 focus:bg-white transition-all duration-300"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-500 mb-3">
        {label}
      </label>

      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full bg-white border border-gray-100 rounded-3xl px-6 py-5 outline-none focus:border-yellow-400 focus:bg-white transition-all duration-300"
      >
        <option value="">Select {label}</option>

        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function PhotoUpload({
  title,
  image,
  onChange,
}) {
  return (
    <div className="bg-white rounded-[36px] p-8 shadow-sm border border-gray-100">
      <h3 className="font-black text-gray-900 text-xl mb-6">{title}</h3>

      <div className="flex flex-col items-center justify-center">
        <div className="w-36 h-36 rounded-full border-4 border-dashed border-yellow-300 overflow-hidden bg-white flex items-center justify-center mb-5">
          {image ? (
            <img
              src={image}
              alt="preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-5xl">📸</span>
          )}
        </div>

        <label className="bg-yellow-400 hover:bg-yellow-500 text-white px-6 py-3 rounded-2xl font-bold cursor-pointer transition-all duration-300 shadow-lg">
          Upload Photo

          <input
            type="file"
            accept="image/*"
            onChange={onChange}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}

export default AddStudent;