/**
 * schema.js — Zod validation for the unified Student Wizard.
 * Mirrors NewAdmission.jsx's validateStep() rules exactly (same required
 * fields, same regex patterns) -- add mode requires student name/dob/
 * gender/class and at least one parent name; edit mode only validates
 * email/phone format when a value is present, matching EditStudent.jsx's
 * current (more lenient) behavior.
 */
import { z } from "zod";

const phoneIfPresent = (v) => !v || /^\d{10}$/.test(v);
const emailIfPresent = (v) => !v || /\S+@\S+\.\S+/.test(v);

export const CLASSES  = ["Daycare", "Playgroup", "Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
export const GENDERS  = ["Male", "Female", "Other"];
export const CENTERS  = ["Seawoods", "Vashi", "Kharghar", "Belapur"];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];
export const RELATIONS = ["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Sibling", "Other"];
export const FEE_TEMPLATES = [
  { id: "full-day",  label: "Full Day Programme",   amount: "₹8,500 / month" },
  { id: "half-day",  label: "Half Day Programme",   amount: "₹5,500 / month" },
  { id: "playgroup", label: "Playgroup Package",    amount: "₹4,000 / month" },
  { id: "daycare",   label: "Daycare (extended)",   amount: "₹10,000 / month" },
  { id: "custom",    label: "Custom / No Template", amount: "Set manually later" },
];
export const DOC_ROWS = [
  { key: "birthCertUpload",       label: "Birth Certificate",         hint: "PDF or image accepted" },
  { key: "addressProofUpload",    label: "Address Proof",             hint: "Aadhaar, utility bill, etc." },
  { key: "vaccineCardUpload",     label: "Vaccination Card",          hint: "Immunisation record" },
  { key: "previousSchoolUpload",  label: "Previous School Records",   hint: "Transfer certificate if applicable" },
  { key: "otherDocUpload",        label: "Other Documents",           hint: "Any additional documents" },
];

export const admissionSchema = z.object({
  studentName: z.string().min(1, "Student name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  studentClass: z.string().min(1, "Class is required"),
  center: z.string().optional(),
  joinDate: z.string().optional(),
  studentPhoto: z.string().nullable().optional(),

  fatherName: z.string().optional(),
  fatherWhatsapp: z.string().optional().refine(phoneIfPresent, "Must be 10 digits"),
  fatherEmail: z.string().optional().refine(emailIfPresent, "Invalid email"),
  fatherOccupation: z.string().optional(),
  fatherPhoto: z.string().nullable().optional(),
  motherName: z.string().optional(),
  motherWhatsapp: z.string().optional().refine(phoneIfPresent, "Must be 10 digits"),
  motherEmail: z.string().optional().refine(emailIfPresent, "Invalid email"),
  motherOccupation: z.string().optional(),
  motherPhoto: z.string().nullable().optional(),
  emergencyName: z.string().optional(),
  emergencyRelation: z.string().optional(),
  emergencyPhone: z.string().optional(),

  bloodGroup: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  doctorName: z.string().optional(),
  doctorPhone: z.string().optional(),
  emergencyNotes: z.string().optional(),
  medicalNotes: z.string().optional(),

  pickupPersons: z.array(z.any()).optional(),

  feeTemplate: z.string().optional(),
  feeNotes: z.string().optional(),

  birthCertUpload: z.string().optional(),
  addressProofUpload: z.string().optional(),
  vaccineCardUpload: z.string().optional(),
  previousSchoolUpload: z.string().optional(),
  otherDocUpload: z.string().optional(),

  familyMode: z.string().optional(),
  selectedFamilyId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.fatherName?.trim() && !data.motherName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fatherName"], message: "At least one parent's name is required" });
  }
});

// Edit mode: same field set for the two included steps, but no
// requiredness -- matching EditStudent.jsx's current (lenient) behavior.
export const editSchema = z.object({
  studentName: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  studentClass: z.string().optional(),
  center: z.string().optional(),
  joinDate: z.string().optional(),
  fatherName: z.string().optional(),
  fatherWhatsapp: z.string().optional().refine(phoneIfPresent, "Must be 10 digits"),
  fatherEmail: z.string().optional().refine(emailIfPresent, "Invalid email"),
  motherName: z.string().optional(),
  motherWhatsapp: z.string().optional().refine(phoneIfPresent, "Must be 10 digits"),
  motherEmail: z.string().optional().refine(emailIfPresent, "Invalid email"),
});

export const EMPTY_DRAFT = {
  studentName: "", dob: "", gender: "", studentClass: "",
  center: "", joinDate: "", studentPhoto: null,
  fatherName: "", fatherWhatsapp: "", fatherEmail: "", fatherOccupation: "", fatherPhoto: null,
  motherName: "", motherWhatsapp: "", motherEmail: "", motherOccupation: "", motherPhoto: null,
  emergencyName: "", emergencyRelation: "", emergencyPhone: "",
  bloodGroup: "", allergies: "", medications: "",
  doctorName: "", doctorPhone: "", emergencyNotes: "", medicalNotes: "",
  pickupPersons: [],
  feeTemplate: "", feeNotes: "",
  birthCertUpload: "", addressProofUpload: "", vaccineCardUpload: "",
  previousSchoolUpload: "", otherDocUpload: "",
  familyMode: "none", selectedFamilyId: "",
};
