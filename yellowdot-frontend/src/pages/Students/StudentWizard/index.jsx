/**
 * StudentWizard — unified Add/Edit Student flow
 * ─────────────────────────────────────────────────────────────────
 * Replaces three separate hand-rolled pages (NewAdmission.jsx,
 * AddStudent.jsx, EditStudent.jsx) with one Wizard-driven flow, reused
 * at all three routes (/students/new, /add-student render this in add
 * mode; /edit-student/:id renders it in edit mode). Same endpoints,
 * same payload shapes, same validation rules as the originals -- see
 * schema.js and the Phase 2.2b audit for the field-by-field mapping.
 *
 * Add mode: 6 steps (Student Info, Parent Details, Medical, Pickup,
 * Fees, Documents), matching NewAdmission.jsx exactly, including its
 * two UI-only steps (Fees/Documents were never persisted to any API in
 * the original either -- not a regression, a preserved fact).
 * Edit mode: 2 steps (Student Info, Parent Details), matching
 * EditStudent.jsx's actual field set -- no photo/medical/pickup/fee/
 * document steps, since EditStudent.jsx never had them.
 * ─────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Wizard, ToastProvider, useToast } from "../../../components/ui";
import { api } from "../../../services/authService";
import familyService from "../../../services/familyService";
import { admissionSchema, editSchema, EMPTY_DRAFT } from "./schema";
import { StepStudentInfo, StepParentDetails, StepMedical, StepPickup, StepFees, StepDocuments } from "./steps";

function formatDateForInput(raw) {
  if (!raw) return "";
  try { return new Date(raw).toISOString().slice(0, 10); } catch { return ""; }
}

function WizardInner() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const rawToast = useToast();
  const toast = { success: (m) => rawToast.show(m, "success"), error: (m) => rawToast.show(m, "error") };

  const [loading, setLoading] = useState(isEdit);
  const [defaultValues, setDefaultValues] = useState(isEdit ? null : EMPTY_DRAFT);
  const [completedName, setCompletedName] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    let mounted = true;
    api.get(`/students/${id}`).then(r => r.data).then(data => {
      if (!mounted) return;
      setDefaultValues({
        ...EMPTY_DRAFT,
        studentName: data.Student_Name || "",
        dob: formatDateForInput(data.DOB),
        gender: data.Gender || "",
        studentClass: data.Class || "",
        center: data.Center || "",
        joinDate: formatDateForInput(data.Join_Date),
        fatherName: data.Father_Name || "",
        fatherWhatsapp: data.Father_WhatsApp || "",
        fatherEmail: data.Father_Email || "",
        motherName: data.Mother_Name || "",
        motherWhatsapp: data.Mother_WhatsApp || "",
        motherEmail: data.Mother_Email || "",
      });
    }).catch(() => { toast.error("Failed to load student."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [isEdit, id]); // eslint-disable-line

  if (loading || !defaultValues) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--yd-text-muted)" }}>Loading…</div>;
  }

  const addSteps = [
    { key: "student", label: "Student Info", fields: StepStudentInfo.fields, render: StepStudentInfo },
    { key: "parents", label: "Parent Details", fields: StepParentDetails.fields, render: StepParentDetails },
    { key: "medical", label: "Medical", optional: true, fields: StepMedical.fields, render: StepMedical },
    { key: "pickup", label: "Pickup Auth", optional: true, fields: StepPickup.fields, render: StepPickup },
    { key: "fees", label: "Fees", optional: true, fields: StepFees.fields, render: StepFees },
    { key: "documents", label: "Documents", optional: true, fields: StepDocuments.fields, render: StepDocuments },
  ];
  const editSteps = [
    { key: "student", label: "Student Info", fields: StepStudentInfo.fields, render: StepStudentInfo },
    { key: "parents", label: "Parent Details", fields: [], render: StepParentDetails },
  ];

  async function handleAddComplete(draft) {
    const res = await api.post("/add-student", {
      student_name: draft.studentName, dob: draft.dob, class: draft.studentClass, gender: draft.gender,
      center: draft.center, join_date: draft.joinDate || new Date().toISOString().slice(0, 10),
      father_name: draft.fatherName, father_whatsapp: draft.fatherWhatsapp, father_email: draft.fatherEmail, father_photo: draft.fatherPhoto || "",
      mother_name: draft.motherName, mother_whatsapp: draft.motherWhatsapp, mother_email: draft.motherEmail, mother_photo: draft.motherPhoto || "",
      profile_image: draft.studentPhoto || "",
    });
    const studentId = res.data?.studentId || res.data?.student?.studentId;

    const hasMedical = draft.bloodGroup || draft.allergies || draft.medications || draft.doctorName;
    if (studentId && hasMedical) {
      await api.put(`/api/student-medical/${studentId}`, {
        bloodGroup: draft.bloodGroup, allergies: draft.allergies, medications: draft.medications,
        doctorName: draft.doctorName, doctorPhone: draft.doctorPhone, emergencyNotes: draft.emergencyNotes, notes: draft.medicalNotes,
      }).catch(() => {});
    }

    if (studentId && draft.pickupPersons?.length > 0) {
      await Promise.allSettled(draft.pickupPersons.map(p => api.post("/api/pickup-authorization", {
        studentId, studentName: draft.studentName, pickupName: p.name, relation: p.relation,
        mobile: p.mobile, photoUrl: p.photoUrl || "", emergency: p.emergency, isParent: false, isProtected: false,
      })));
    }

    if (studentId) {
      if (draft.familyMode === "existing" && draft.selectedFamilyId) {
        await familyService.linkStudent(draft.selectedFamilyId, studentId).catch(() => {});
      } else if (draft.familyMode === "new") {
        const { familyId } = await familyService.create({
          fatherName: draft.fatherName, motherName: draft.motherName,
          primaryContact: draft.fatherWhatsapp || draft.motherWhatsapp, email: draft.fatherEmail || draft.motherEmail,
        }).catch(() => ({ familyId: null }));
        if (familyId) await familyService.linkStudent(familyId, studentId).catch(() => {});
      }
    }
    return draft.studentName;
  }

  async function handleEditComplete(draft) {
    const res = await api.put(`/update-student/${id}`, {
      student_name: draft.studentName, dob: draft.dob, class: draft.studentClass, join_date: draft.joinDate,
      gender: draft.gender, center: draft.center,
      father_name: draft.fatherName, father_whatsapp: draft.fatherWhatsapp, father_email: draft.fatherEmail,
      mother_name: draft.motherName, mother_whatsapp: draft.motherWhatsapp, mother_email: draft.motherEmail,
    });
    if (!res.data?.success) throw new Error(res.data?.message || "Failed to update student.");
    return draft.studentName;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate("/students")} className="yd-back-link" style={{ marginLeft: -8, marginBottom: 6 }}>
          <ArrowLeft size={13} strokeWidth={2.5} /> Students
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--yd-charcoal)" }}>{isEdit ? "Edit Student" : "New Admission"}</h1>
        <p style={{ fontSize: 13, color: "var(--yd-text-muted)", marginTop: 2 }}>
          {isEdit ? "Update this student's details." : "Enroll a new student in a few guided steps."}
        </p>
      </div>

      <Wizard
        steps={isEdit ? editSteps : addSteps}
        schema={isEdit ? editSchema : admissionSchema}
        defaultValues={defaultValues}
        autosaveKey={isEdit ? undefined : "yd_admission_draft"}
        onComplete={async (draft) => {
          try {
            const name = isEdit ? await handleEditComplete(draft) : await handleAddComplete(draft);
            setCompletedName(name);
          } catch (e) {
            toast.error(e?.response?.data?.message || e.message || "Failed to save. Please try again.");
            throw e;
          }
        }}
        successState={{
          icon: <CheckCircle2 size={28} strokeWidth={2} />,
          title: isEdit ? "Student updated!" : "Admission submitted!",
          description: isEdit ? "The student's details have been saved." : "The new student has been enrolled successfully.",
          action: { label: "Back to Students", onClick: () => navigate("/students", isEdit ? undefined : { state: { admissionSuccess: completedName } }) },
        }}
      />
    </div>
  );
}

export default function StudentWizard() {
  return (
    <ToastProvider>
      <WizardInner />
    </ToastProvider>
  );
}
