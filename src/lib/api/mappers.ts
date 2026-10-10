import type { Doctor, Gender, Patient, User } from "../types";

/**
 * Wire shapes.
 *
 * The API returns `null` for absent optional columns (SQL NULL), while the UI
 * models them as optional properties. These row types make that difference
 * explicit, and the `to*` mappers below are the single place it is normalised.
 */
export type ApiDoctor = Omit<Doctor, "avatarUrl"> & { avatarUrl: string | null };

export type ApiPatient = Omit<Patient, "email" | "notes" | "avatarUrl"> & {
  email: string | null;
  notes: string | null;
  avatarUrl: string | null;
};

export type ApiUser = Omit<User, "avatarUrl"> & { avatarUrl: string | null };

export type ApiDoctorDetail = ApiDoctor & { latestPatientAt: string | null };

function optional(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

export function toDoctor(row: ApiDoctor): Doctor {
  return { ...row, avatarUrl: optional(row.avatarUrl) };
}

export function toPatient(row: ApiPatient): Patient {
  return {
    ...row,
    email: optional(row.email),
    notes: optional(row.notes),
    avatarUrl: optional(row.avatarUrl),
  };
}

export function toUser(row: ApiUser): User {
  return { ...row, avatarUrl: optional(row.avatarUrl) };
}

/** Narrowing helper used by the gender filter. */
export const isGender = (value: string): value is Gender =>
  value === "MALE" || value === "FEMALE" || value === "OTHER";
