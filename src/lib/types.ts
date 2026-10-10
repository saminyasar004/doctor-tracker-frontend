export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  avatarUrl?: string | undefined;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  email?: string | undefined;
  condition: string;
  notes?: string | undefined;
  avatarUrl?: string | undefined;
  doctorId: string;
  doctor?: { id: string; name: string; specialization: string } | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | undefined;
}

export type DoctorInput = Omit<Doctor, "id" | "patientCount" | "createdAt" | "updatedAt">;
export type PatientInput = Omit<Patient, "id" | "doctor" | "createdAt" | "updatedAt">;

export interface DoctorOption {
  id: string;
  name: string;
  /** Absent in the `/patients/filter-options` payload, which returns `{ id, name }`. */
  specialization?: string | undefined;
  avatarUrl?: string | undefined;
}

/**
 * Suggestions for the free-text inputs. The authoritative lists come from
 * `GET /doctors/filter-options` and `GET /patients/filter-options`, so the UI
 * always offers values that exist in the database; these are only the fallback
 * for the first paint and for values typed by hand.
 */
export const SPECIALIZATIONS = [
  "Cardiology",
  "Dermatology",
  "ENT",
  "Gynecology",
  "Neurology",
  "Oncology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Radiology",
] as const;

export const CONDITIONS = [
  "Anxiety",
  "Arthritis",
  "Asthma",
  "Back Pain",
  "Diabetes",
  "Eczema",
  "Flu",
  "Fracture",
  "Hypertension",
  "Migraine",
] as const;

export const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];
export const GENDER_LABEL: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};
