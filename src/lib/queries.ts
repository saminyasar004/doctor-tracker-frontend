import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getDashboard, type DashboardRange } from "./api/dashboard";
import {
  getDoctor,
  listDoctorFilterOptions,
  listDoctorOptions,
  listDoctorPatients,
  listDoctors,
  type DoctorPatientFilters,
  type DoctorPatientQuery,
  type DoctorQuery,
} from "./api/doctors";
import { listPatientFilterOptions, listPatients, type PatientQuery } from "./api/patients";

export const doctorsQuery = (q: DoctorQuery) =>
  queryOptions({
    queryKey: ["doctors", "list", q],
    queryFn: () => listDoctors(q),
    placeholderData: keepPreviousData,
  });

export const doctorQuery = (id: string) =>
  queryOptions({ queryKey: ["doctors", "detail", id], queryFn: () => getDoctor(id), retry: false });

export const doctorFilterOptionsQuery = queryOptions({
  queryKey: ["doctors", "filter-options"],
  queryFn: listDoctorFilterOptions,
  staleTime: 5 * 60_000,
});

export const doctorOptionsQuery = queryOptions({
  queryKey: ["doctors", "options"],
  queryFn: listDoctorOptions,
  staleTime: 5 * 60_000,
});

export type DoctorPatientsQueryInput = Partial<DoctorPatientFilters> &
  Pick<DoctorPatientQuery, "limit"> & { limit?: number | undefined };

export const doctorPatientsQuery = (id: string, q: DoctorPatientsQueryInput) =>
  queryOptions({
    queryKey: ["doctors", id, "patients", q],
    queryFn: () => listDoctorPatients(id, q),
    placeholderData: keepPreviousData,
    enabled: !!id,
  });

export const patientsQuery = (q: PatientQuery) =>
  queryOptions({
    queryKey: ["patients", "list", q],
    queryFn: () => listPatients(q),
    placeholderData: keepPreviousData,
  });

export const patientFilterOptionsQuery = queryOptions({
  queryKey: ["patients", "filter-options"],
  queryFn: listPatientFilterOptions,
  staleTime: 5 * 60_000,
});

export const dashboardQuery = (range: DashboardRange) =>
  queryOptions({
    queryKey: ["dashboard", range],
    queryFn: () => getDashboard(range),
    placeholderData: keepPreviousData,
  });

/** Query keys that become stale after a create/update/delete. */
export const doctorKeys = {
  all: ["doctors"] as const,
  lists: () => ["doctors", "list"] as const,
  options: () => ["doctors", "options"] as const,
  filterOptions: () => ["doctors", "filter-options"] as const,
};

export const patientKeys = {
  all: ["patients"] as const,
  lists: () => ["patients", "list"] as const,
  filterOptions: () => ["patients", "filter-options"] as const,
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
};
