import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../services/authService";

function StudentProfile() {
  const { id } = useParams();

  const [student, setStudent] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});

  // FETCH STUDENT
  useEffect(() => {
    api.get(`/students/${id}`)
      .then((res) => res.data)
      .then((data) => {
        setStudent(data);
        setFormData(data);
      })
      .catch((err) => console.log(err));
  }, [id]);

  // HANDLE INPUT CHANGE
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // SAVE CHANGES
  const handleSave = async () => {
    try {
      const updatedStudent = await api.put(`/students/${id}`, formData).then(r => r.data);

      setStudent(updatedStudent);
      setEditMode(false);

    } catch (error) {
      console.log(error);
    }
  };

  // LOADING
  if (!student) {
    return (
      <div className="flex items-center justify-center h-screen text-3xl font-bold">
        Loading Student...
      </div>
    );
  }

  return (
    <div className="flex bg-[#F8F7F2] min-h-screen">

      {/* SIDEBAR */}
      <Sidebar />

      {/* MAIN CONTENT */}
      <div className="ml-[260px] w-full p-8">

        {/* TOPBAR */}
        <div className="flex items-center justify-between mb-8">

          <div>
            <h2 className="text-4xl font-black text-[#0F172A]">
              Good Morning 👋
            </h2>

            <p className="text-gray-500 mt-2 text-lg">
              Welcome back to Yellow Dot CRM
            </p>
          </div>

          <div className="flex items-center gap-5">

            <div className="w-16 h-16 rounded-3xl bg-white shadow-md flex items-center justify-center text-xl">
              🔔
            </div>

            <div className="bg-white rounded-3xl px-5 py-3 shadow-md flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-yellow-400 flex items-center justify-center text-white font-black text-xl">
                K
              </div>

              <div>
                <h3 className="font-bold text-[#0F172A]">
                  Kunal
                </h3>

                <p className="text-gray-500 text-sm">
                  Admin
                </p>
              </div>
            </div>

          </div>

        </div>

        {/* HERO CARD */}
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-[40px] p-10 shadow-2xl relative overflow-hidden mb-10">

          <div className="flex items-center gap-8">

            {/* PROFILE ICON */}
            <div className="w-36 h-36 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-6xl text-white font-black shadow-2xl">
              {student.Student_Name?.charAt(0)}
            </div>

            {/* DETAILS */}
            <div>

              {editMode ? (
                <input
                  type="text"
                  name="Student_Name"
                  value={formData.Student_Name || ""}
                  onChange={handleChange}
                  className="bg-white/20 border border-white/30 text-white text-6xl font-black rounded-3xl px-6 py-3 outline-none"
                />
              ) : (
                <h1 className="text-6xl font-black text-white">
                  {student.Student_Name}
                </h1>
              )}

              <p className="text-white/90 text-2xl mt-3">
                {student.Class} • {student.Center}
              </p>

              <div className="flex gap-4 mt-6">

                <div className="bg-white/20 text-white px-6 py-3 rounded-2xl font-bold backdrop-blur-md">
                  Active
                </div>

                <div className="bg-white/20 text-white px-6 py-3 rounded-2xl font-bold backdrop-blur-md">
                  {student.Student_ID}
                </div>

                <div className="bg-white/20 text-white px-6 py-3 rounded-2xl font-bold backdrop-blur-md">
                  Joined: {student.Admission_Date || "N/A"}
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">

          <div>
            <h1 className="text-6xl font-black text-[#0F172A]">
              Student Profile
            </h1>

            <p className="text-gray-500 mt-2 text-xl">
              Complete student information & parent details
            </p>
          </div>

          <button
            onClick={() =>
              editMode ? handleSave() : setEditMode(true)
            }
            className="bg-yellow-400 hover:bg-yellow-500 text-white font-bold px-10 py-5 rounded-3xl shadow-xl transition-all duration-300 text-lg"
          >
            {editMode ? "Save Changes" : "Edit Profile"}
          </button>

        </div>

        {/* TOP STATS */}
        <div className="grid grid-cols-4 gap-6 mb-8">

          <div className="bg-white rounded-[30px] p-8 shadow-sm">
            <p className="text-gray-400 font-medium">
              Attendance
            </p>

            <h2 className="text-5xl font-black text-[#0F172A] mt-4">
              92%
            </h2>
          </div>

          <div className="bg-white rounded-[30px] p-8 shadow-sm">
            <p className="text-gray-400 font-medium">
              Fee Status
            </p>

            <h2 className="text-4xl font-black text-green-500 mt-4">
              Paid
            </h2>
          </div>

          <div className="bg-white rounded-[30px] p-8 shadow-sm">
            <p className="text-gray-400 font-medium">
              Medical Alert
            </p>

            <h2 className="text-2xl font-black text-red-500 mt-4">
              Peanut Allergy
            </h2>
          </div>

          <div className="bg-white rounded-[30px] p-8 shadow-sm">
            <p className="text-gray-400 font-medium">
              Vaccination
            </p>

            <h2 className="text-3xl font-black text-blue-500 mt-4">
              Updated
            </h2>
          </div>

        </div>

        {/* INFORMATION CARDS */}
        <div className="grid grid-cols-2 gap-8">

          {/* PERSONAL INFO */}
          <div className="bg-white rounded-[35px] p-10 shadow-sm">

            <h2 className="text-4xl font-black text-[#0F172A] mb-10">
              Personal Information
            </h2>

            <div className="grid grid-cols-2 gap-10">

              {/* DOB */}
              <div>
                <p className="text-gray-400 mb-3">
                  Date of Birth
                </p>

                {editMode ? (
                  <input
                    type="text"
                    name="DOB"
                    value={formData.DOB || ""}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-xl font-bold outline-none focus:border-yellow-400"
                  />
                ) : (
                  <h3 className="text-2xl font-black text-[#0F172A]">
                    {student.DOB}
                  </h3>
                )}
              </div>

              {/* GENDER */}
              <div>
                <p className="text-gray-400 mb-3">
                  Gender
                </p>

                <h3 className="text-2xl font-black text-[#0F172A]">
                  {student.Gender || "Male"}
                </h3>
              </div>

              {/* CLASS */}
              <div>
                <p className="text-gray-400 mb-3">
                  Class
                </p>

                {editMode ? (
                  <input
                    type="text"
                    name="Class"
                    value={formData.Class || ""}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-xl font-bold outline-none focus:border-yellow-400"
                  />
                ) : (
                  <h3 className="text-2xl font-black text-[#0F172A]">
                    {student.Class}
                  </h3>
                )}
              </div>

              {/* CENTER */}
              <div>
                <p className="text-gray-400 mb-3">
                  Center
                </p>

                {editMode ? (
                  <input
                    type="text"
                    name="Center"
                    value={formData.Center || ""}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-xl font-bold outline-none focus:border-yellow-400"
                  />
                ) : (
                  <h3 className="text-2xl font-black text-[#0F172A]">
                    {student.Center}
                  </h3>
                )}
              </div>

            </div>

          </div>

          {/* PARENT DETAILS */}
          <div className="bg-white rounded-[35px] p-10 shadow-sm">

            <h2 className="text-4xl font-black text-[#0F172A] mb-10">
              Parent Details
            </h2>

            <div className="grid grid-cols-2 gap-10">

              {/* FATHER NAME */}
              <div>
                <p className="text-gray-400 mb-3">
                  Father Name
                </p>

                {editMode ? (
                  <input
                    type="text"
                    name="Father_Name"
                    value={formData.Father_Name || ""}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-xl font-bold outline-none focus:border-yellow-400"
                  />
                ) : (
                  <h3 className="text-2xl font-black text-[#0F172A]">
                    {student.Father_Name}
                  </h3>
                )}
              </div>

              {/* MOTHER NAME */}
              <div>
                <p className="text-gray-400 mb-3">
                  Mother Name
                </p>

                <h3 className="text-2xl font-black text-[#0F172A]">
                  {student.Mother_Name || "N/A"}
                </h3>
              </div>

              {/* WHATSAPP */}
              <div>
                <p className="text-gray-400 mb-3">
                  Father WhatsApp
                </p>

                {editMode ? (
                  <input
                    type="text"
                    name="Father_Whatsapp"
                    value={formData.Father_Whatsapp || ""}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-xl font-bold outline-none focus:border-yellow-400"
                  />
                ) : (
                  <h3 className="text-2xl font-black text-[#0F172A]">
                    {student.Father_Whatsapp}
                  </h3>
                )}
              </div>

              {/* EMAIL */}
              <div>
                <p className="text-gray-400 mb-3">
                  Father Email
                </p>

                <h3 className="text-xl font-bold text-[#0F172A] break-all">
                  {student.Father_Email || "N/A"}
                </h3>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default StudentProfile;