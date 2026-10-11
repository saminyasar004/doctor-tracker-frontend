import type { Doctor, DoctorInput, DoctorOption, Paginated, Patient, PatientInput } from "../types";
import { apiFetch, apiFetchPaginated, toQuery } from "./client";
import type { ApiDoctor, ApiDoctorDetail, ApiPatient } from "./mappers";
import { toDoctor, toPatient } from "./mappers";

/** Sort options offered by the UI, mapped onto the API's `sortBy` + `order`. */
export type DoctorSort =
  "newest" | "oldest" | "name-asc" | "name-desc" | "patients-desc" | "patients-asc";

export interface DoctorQuery {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  specialization?: string | undefined;
  hospital?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  sort?: DoctorSort | undefined;
}

const DOCTOR_SORTS: Record<DoctorSort, { sortBy: string; order: "asc" | "desc" }> = {
  newest: { sortBy: "createdAt", order: "desc" },
  oldest: { sortBy: "createdAt", order: "asc" },
  "name-asc": { sortBy: "name", order: "asc" },
  "name-desc": { sortBy: "name", order: "desc" },
  "patients-desc": { sortBy: "patientCount", order: "desc" },
  "patients-asc": { sortBy: "patientCount", order: "asc" },
};

export const DOCTOR_SORT_OPTIONS: { value: DoctorSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "patients-desc", label: "Most patients" },
  { value: "patients-asc", label: "Fewest patients" },
];

/** UI date strings (`yyyy-MM-dd`) become the inclusive ISO bounds the API expects. */
export function toIsoBound(value: string | undefined, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export async function listDoctors(q: DoctorQuery = {}): Promise<Paginated<Doctor>> {
  const sort = DOCTOR_SORTS[q.sort ?? "newest"];
  const query = toQuery({
    page: q.page,
    limit: q.limit,
    search: q.search,
    specialization: q.specialization,
    hospital: q.hospital,
    createdFrom: toIsoBound(q.from),
    createdTo: toIsoBound(q.to, true),
    sortBy: sort.sortBy,
    order: sort.order,
  });

  const page = await apiFetchPaginated<ApiDoctor>(`/doctors${query}`);
  return { data: page.data.map(toDoctor), meta: page.meta };
}

/** Doctor profile plus the aggregate the detail page shows. */
export type DoctorDetail = Doctor & { latestPatientAt: string | null };

export async function getDoctor(id: string): Promise<DoctorDetail> {
  const row = await apiFetch<ApiDoctorDetail>(`/doctors/${id}`);
  return { ...toDoctor(row), latestPatientAt: row.latestPatientAt };
}

export async function createDoctor(input: DoctorInput): Promise<Doctor> {
  return toDoctor(await apiFetch<ApiDoctor>("/doctors", { method: "POST", body: input }));
}

export async function updateDoctor(id: string, input: Partial<DoctorInput>): Promise<Doctor> {
  return toDoctor(await apiFetch<ApiDoctor>(`/doctors/${id}`, { method: "PATCH", body: input }));
}

/** Deletes the doctor; the API cascades to their patients and reports how many went. */
export async function deleteDoctor(
  id: string,
): Promise<{ deleted: boolean; deletedPatients: number }> {
  return apiFetch(`/doctors/${id}`, { method: "DELETE" });
}

export interface DoctorFilterOptions {
  specializations: string[];
  hospitals: string[];
}

export async function listDoctorFilterOptions(): Promise<DoctorFilterOptions> {
  return apiFetch<DoctorFilterOptions>("/doctors/filter-options");
}

export async function listDoctorOptions(): Promise<DoctorOption[]> {
  const page = await apiFetchPaginated<ApiDoctor>("/doctors?limit=100&sortBy=name&order=asc");
  return page.data.map((d) => {
    const doctor = toDoctor(d);
    return {
      id: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
      avatarUrl: doctor.avatarUrl,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*                        A doctor's patients (nested routes)                 */
/* -------------------------------------------------------------------------- */

export type PatientSort = "newest" | "oldest" | "name-asc" | "name-desc" | "age-asc" | "age-desc";

const PATIENT_SORTS: Record<PatientSort, { sortBy: string; order: "asc" | "desc" }> = {
  newest: { sortBy: "createdAt", order: "desc" },
  oldest: { sortBy: "createdAt", order: "asc" },
  "name-asc": { sortBy: "name", order: "asc" },
  "name-desc": { sortBy: "name", order: "desc" },
  "age-asc": { sortBy: "age", order: "asc" },
  "age-desc": { sortBy: "age", order: "desc" },
};

export interface DoctorPatientQuery {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  condition?: string | undefined;
  gender?: Patient["gender"] | undefined;
  sort?: PatientSort | undefined;
}

/** Search + condition + sort, the filters a doctor's patient list supports. */
export type DoctorPatientFilters = Pick<DoctorPatientQuery, "search" | "condition" | "sort">;

export async function listDoctorPatients(
  doctorId: string,
  q: DoctorPatientQuery = {},
): Promise<Paginated<Patient>> {
  const sort = PATIENT_SORTS[q.sort ?? "newest"];
  const query = toQuery({
    page: q.page,
    limit: q.limit,
    search: q.search,
    condition: q.condition,
    gender: q.gender,
    sortBy: sort.sortBy,
    order: sort.order,
  });

  const page = await apiFetchPaginated<ApiPatient>(`/doctors/${doctorId}/patients${query}`);
  return { data: page.data.map(toPatient), meta: page.meta };
}

export async function addDoctorPatient(
  doctorId: string,
  input: Omit<PatientInput, "doctorId">,
): Promise<Patient> {
  return toPatient(
    await apiFetch<ApiPatient>(`/doctors/${doctorId}/patients`, { method: "POST", body: input }),
  );
}

export async function removeDoctorPatient(doctorId: string, patientId: string): Promise<void> {
  await apiFetch(`/doctors/${doctorId}/patients/${patientId}`, { method: "DELETE" });
}

export { PATIENT_SORTS };
