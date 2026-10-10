import { format } from "date-fns";
import type { Doctor, Patient } from "../types";
import { apiFetch, apiFetchPaginated } from "./client";
import type { ApiDoctor, ApiPatient } from "./mappers";
import { toDoctor, toPatient } from "./mappers";

/** Range selector of the dashboard header. */
export type DashboardRange = "7D" | "30D" | "12M";

/** API ranges differ from the UI labels by case only. */
const RANGE_PARAM: Record<DashboardRange, "7d" | "30d" | "12m"> = {
  "7D": "7d",
  "30D": "30d",
  "12M": "12m",
};

export interface Kpi {
  value: number;
  delta: number;
  spark: number[];
}

export interface DashboardData {
  kpis: { totalDoctors: Kpi; totalPatients: Kpi; avgPerDoctor: Kpi; newThisMonth: Kpi };
  patientsPerDoctor: { name: string; specialization: string; patients: number }[];
  growth: { label: string; patients: number; doctors: number }[];
  conditions: { name: string; value: number }[];
  specializations: { name: string; doctors: number; patients: number }[];
  recentPatients: Patient[];
  topDoctors: Doctor[];
}

interface ApiSummary {
  totalDoctors: number;
  totalPatients: number;
  avgPatientsPerDoctor: number;
  newPatientsThisMonth: number;
  newPatientsLastMonth: number;
  patientsGrowthPercent: number | null;
  newDoctorsThisMonth: number;
}

interface ApiTimelinePoint {
  date: string;
  patients: number;
  doctors: number;
}

interface ApiPerDoctor {
  doctorId: string;
  name: string;
  specialization: string;
  patientCount: number;
}

interface ApiCondition {
  condition: string;
  count: number;
  percentage: number;
}

interface ApiSpecialization {
  specialization: string;
  doctors: number;
  patients: number;
}

/** Percentage change of `now` against `before`; 0 when the baseline is empty. */
function pct(now: number, before: number): number {
  if (before <= 0) return now > 0 ? 100 : 0;
  return ((now - before) / before) * 100;
}

/** Running total, used for the KPI sparklines. */
function cumulative(values: number[]): number[] {
  return values.reduce<number[]>((acc, value) => {
    const previous = acc[acc.length - 1] ?? 0;
    acc.push(previous + value);
    return acc;
  }, []);
}

/**
 * Loads the whole dashboard.
 *
 * Every panel comes from its own SQL aggregation on the API, and all of them are
 * independent, so they are requested in parallel rather than sequentially.
 */
export async function getDashboard(range: DashboardRange): Promise<DashboardData> {
  const rangeParam = RANGE_PARAM[range];
  const isMonth = range === "12M";
  const bucketLabel = (iso: string) =>
    format(new Date(iso), isMonth ? "MMM" : range === "7D" ? "EEE" : "MMM d");

  const [summary, timeline, perDoctor, conditions, specializations, recent, topDoctors] =
    await Promise.all([
      apiFetch<ApiSummary>("/dashboard/summary"),
      apiFetch<ApiTimelinePoint[]>(`/dashboard/timeline?range=${rangeParam}`),
      apiFetch<ApiPerDoctor[]>("/dashboard/patients-per-doctor?limit=8"),
      apiFetch<ApiCondition[]>("/dashboard/conditions?limit=8"),
      apiFetch<ApiSpecialization[]>("/dashboard/specializations"),
      apiFetchPaginated<ApiPatient>("/patients?limit=6&sortBy=createdAt&order=desc"),
      apiFetchPaginated<ApiDoctor>("/doctors?limit=5&sortBy=patientCount&order=desc"),
    ]);

  const patientSeries = timeline.map((p) => p.patients);
  const doctorSeries = timeline.map((p) => p.doctors);

  // Records created inside the selected window, and what was left before it.
  const addedPatients = patientSeries.reduce((sum, n) => sum + n, 0);
  const addedDoctors = doctorSeries.reduce((sum, n) => sum + n, 0);
  const patientsBefore = Math.max(0, summary.totalPatients - addedPatients);
  const doctorsBefore = Math.max(0, summary.totalDoctors - addedDoctors);
  const avgBefore = doctorsBefore > 0 ? patientsBefore / doctorsBefore : 0;

  const sparkPatients = cumulative(patientSeries);
  const sparkDoctors = cumulative(doctorSeries);

  return {
    kpis: {
      totalDoctors: {
        value: summary.totalDoctors,
        delta: pct(summary.totalDoctors, doctorsBefore),
        spark: sparkDoctors,
      },
      totalPatients: {
        value: summary.totalPatients,
        delta: pct(summary.totalPatients, patientsBefore),
        spark: sparkPatients,
      },
      avgPerDoctor: {
        value: summary.avgPatientsPerDoctor,
        delta: pct(summary.avgPatientsPerDoctor, avgBefore),
        spark: sparkPatients.map((p, i) => {
          const d = sparkDoctors[i] ?? 0;
          return d > 0 ? p / d : 0;
        }),
      },
      newThisMonth: {
        value: summary.newPatientsThisMonth,
        delta: summary.patientsGrowthPercent ?? 0,
        spark: patientSeries,
      },
    },
    patientsPerDoctor: perDoctor.map((d) => ({
      name: d.name,
      specialization: d.specialization,
      patients: d.patientCount,
    })),
    growth: timeline.map((p) => ({
      label: bucketLabel(p.date),
      patients: p.patients,
      doctors: p.doctors,
    })),
    conditions: conditions.map((c) => ({ name: c.condition, value: c.count })),
    specializations: specializations.map((s) => ({
      name: s.specialization,
      doctors: s.doctors,
      patients: s.patients,
    })),
    recentPatients: recent.data.map(toPatient),
    topDoctors: topDoctors.data.map(toDoctor),
  };
}

export interface SearchResult {
  type: "doctor" | "patient";
  id: string;
  title: string;
  subtitle: string;
  avatarUrl?: string | undefined;
}

/** Backs the topbar command palette (Cmd/Ctrl+K) with the API's search endpoints. */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const term = query.trim();
  if (!term) return [];

  const [doctors, patients] = await Promise.all([
    apiFetchPaginated<ApiDoctor>(`/doctors?search=${encodeURIComponent(term)}&limit=5`),
    apiFetchPaginated<ApiPatient>(`/patients?search=${encodeURIComponent(term)}&limit=6`),
  ]);

  const doctorHits: SearchResult[] = doctors.data.map((row) => {
    const d = toDoctor(row);
    return {
      type: "doctor",
      id: d.id,
      title: d.name,
      subtitle: `${d.specialization} · ${d.hospital}`,
      avatarUrl: d.avatarUrl,
    };
  });

  const patientHits: SearchResult[] = patients.data.map((row) => {
    const p = toPatient(row);
    return {
      type: "patient",
      id: p.id,
      title: p.name,
      subtitle: `${p.condition} · ${p.age} yrs`,
      avatarUrl: p.avatarUrl,
    };
  });

  return [...doctorHits, ...patientHits];
}
