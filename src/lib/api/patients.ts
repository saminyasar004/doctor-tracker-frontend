import type { DoctorOption, Gender, Paginated, Patient, PatientInput } from "../types";
import { apiFetch, apiFetchPaginated, toQuery } from "./client";
import { PATIENT_SORTS, toIsoBound, type PatientSort } from "./doctors";
import type { ApiPatient } from "./mappers";
import { toPatient } from "./mappers";

export type { PatientSort };

export interface PatientQuery {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  condition?: string | undefined;
  doctorId?: string | undefined;
  gender?: Gender | undefined;
  from?: string | undefined;
  to?: string | undefined;
  sort?: PatientSort | undefined;
}

export const PATIENT_SORT_OPTIONS: { value: PatientSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "age-asc", label: "Age (youngest)" },
  { value: "age-desc", label: "Age (oldest)" },
];

export async function listPatients(q: PatientQuery = {}): Promise<Paginated<Patient>> {
  const sort = PATIENT_SORTS[q.sort ?? "newest"];
  const query = toQuery({
    page: q.page,
    limit: q.limit,
    search: q.search,
    condition: q.condition,
    doctorId: q.doctorId,
    gender: q.gender,
    createdFrom: toIsoBound(q.from),
    createdTo: toIsoBound(q.to, true),
    sortBy: sort.sortBy,
    order: sort.order,
  });

  const page = await apiFetchPaginated<ApiPatient>(`/patients${query}`);
  return { data: page.data.map(toPatient), meta: page.meta };
}

export async function getPatient(id: string): Promise<Patient> {
  return toPatient(await apiFetch<ApiPatient>(`/patients/${id}`));
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  return toPatient(await apiFetch<ApiPatient>("/patients", { method: "POST", body: input }));
}

export async function updatePatient(id: string, input: Partial<PatientInput>): Promise<Patient> {
  return toPatient(await apiFetch<ApiPatient>(`/patients/${id}`, { method: "PATCH", body: input }));
}

export async function deletePatient(id: string): Promise<void> {
  await apiFetch(`/patients/${id}`, { method: "DELETE" });
}

export interface PatientFilterOptions {
  conditions: string[];
  /** `{ id, name }` pairs, exactly what the `doctorId` filter expects. */
  doctors: Array<Pick<DoctorOption, "id" | "name">>;
}

/** Conditions in use plus every doctor, for the filter bar and the doctor picker. */
export async function listPatientFilterOptions(): Promise<PatientFilterOptions> {
  return apiFetch<PatientFilterOptions>("/patients/filter-options");
}
