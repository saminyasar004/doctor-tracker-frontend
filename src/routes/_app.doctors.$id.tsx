import { useMemo, useState } from "react";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, subMonths } from "date-fns";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/data-table";
import { FilterBar, FilterSelect } from "@/components/common/filters";
import { Pagination } from "@/components/common/app-pagination";
import { SearchInput } from "@/components/common/search-input";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/common/states";
import { ConditionBadge, GenderBadge, SpecializationBadge } from "@/components/common/badges";
import { RelativeDate } from "@/components/common/misc";
import { UserAvatar } from "@/components/common/user-avatar";
import { MonthlyBars } from "@/components/charts/charts";
import { DoctorForm } from "@/components/forms/doctor-form";
import { PatientForm } from "@/components/forms/patient-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  addDoctorPatient,
  deleteDoctor,
  listDoctorOptions,
  removeDoctorPatient,
  updateDoctor,
  type DoctorPatientQuery,
} from "@/lib/api/doctors";
import { listPatientFilterOptions } from "@/lib/api/patients";
import {
  doctorKeys,
  doctorPatientsQuery,
  doctorQuery,
  doctorFilterOptionsQuery,
} from "@/lib/queries";
import { oneOf, posInt, str } from "@/lib/search-params";
import type { DoctorInput, Patient, PatientInput } from "@/lib/types";

const PATIENT_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "age-asc", label: "Age (youngest)" },
  { value: "age-desc", label: "Age (oldest)" },
] as const;

const SORT_VALUES = PATIENT_SORTS.map((s) => s.value);

export type DoctorProfileSearch = {
  q?: string | undefined;
  condition?: string | undefined;
  sort?: (typeof SORT_VALUES)[number] | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/_app/doctors/$id")({
  validateSearch: (s: Record<string, unknown>): DoctorProfileSearch => ({
    q: str(s["q"]),
    condition: str(s["condition"]),
    sort: oneOf(s["sort"], SORT_VALUES),
    page: posInt(s["page"]),
  }),
  head: () => ({
    meta: [
      { title: "Doctor profile — Doctor Tracker" },
      { name: "description", content: "Profile, workload and patients of one doctor." },
      { property: "og:title", content: "Doctor profile — Doctor Tracker" },
      { property: "og:description", content: "Profile, workload and patients of one doctor." },
    ],
  }),
  component: DoctorProfilePage,
});

function DoctorProfilePage() {
  const { id } = useParams({ from: "/_app/doctors/$id" });
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingPatientDelete, setPendingPatientDelete] = useState<Patient | undefined>();
  const [confirmDoctorDelete, setConfirmDoctorDelete] = useState(false);

  const { data: doctor, isPending, isError, error, refetch } = useQuery(doctorQuery(id));
  const { data: doctorOptions } = useQuery({
    queryKey: ["doctors", "options"],
    queryFn: listDoctorOptions,
    staleTime: 5 * 60_000,
  });
  const { data: doctorFilters } = useQuery(doctorFilterOptionsQuery);

  const patientFilters: DoctorPatientQuery = {
    page: search.page,
    limit: 8,
    search: search.q,
    condition: search.condition,
    sort: search.sort,
  };
  const {
    data: patients,
    isPending: patientsPending,
    isFetching: patientsFetching,
  } = useQuery(doctorPatientsQuery(id, patientFilters));
  const { data: conditionOptions } = useQuery({
    queryKey: ["patients", "filter-options"],
    queryFn: listPatientFilterOptions,
    staleTime: 5 * 60_000,
  });

  /**
   * Intake history, from the doctor's 100 most recent patients.
   *
   * The API has no per-doctor time-series endpoint, so this bounded page is
   * bucketed client-side. It is exact for doctors with <= 100 patients (the
   * common case here) and the card says so when more exist.
   */
  const { data: intake, isPending: intakePending } = useQuery(
    doctorPatientsQuery(id, { limit: 100, sort: "newest" }),
  );

  /** Refreshes the profile, its patients, the lists and the dashboard together. */
  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["doctors"] }),
      queryClient.invalidateQueries({ queryKey: ["patients"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const saveDoctor = useMutation({
    mutationFn: (input: DoctorInput) => updateDoctor(id, input),
    onSuccess: async () => {
      toast.success("Doctor updated");
      setEditOpen(false);
      await refreshAll();
    },
    onError: (e: Error) => toast.error("Could not save the doctor", { description: e.message }),
  });

  const deleteThisDoctor = useMutation({
    mutationFn: () => deleteDoctor(id),
    onSuccess: async ({ deletedPatients }) => {
      toast.success("Doctor deleted", {
        description: deletedPatients
          ? `${deletedPatients} patient${deletedPatients === 1 ? "" : "s"} removed with the doctor.`
          : "The doctor had no patients.",
      });
      setConfirmDoctorDelete(false);
      await refreshAll();
      await navigate({ to: "/doctors" });
    },
    onError: (e: Error) => toast.error("Could not delete the doctor", { description: e.message }),
  });

  const addPatient = useMutation({
    // `doctorId` comes from the URL; the nested endpoint does not accept it in the body.
    mutationFn: ({ doctorId: _ignored, ...input }: PatientInput) => addDoctorPatient(id, input),
    onSuccess: async (created) => {
      toast.success("Patient added", { description: `${created.name} · ${created.condition}` });
      setAddOpen(false);
      await refreshAll();
    },
    onError: (e: Error) => toast.error("Could not add the patient", { description: e.message }),
  });

  const removePatient = useMutation({
    mutationFn: (patient: Patient) => removeDoctorPatient(id, patient.id),
    onSuccess: async () => {
      toast.success("Patient removed");
      setPendingPatientDelete(undefined);
      await refreshAll();
    },
    onError: (e: Error) => toast.error("Could not remove the patient", { description: e.message }),
  });

  /** Patients added per month, from the doctor's own (bounded) patient page. */
  /** True when the doctor has more patients than the single chart page covers. */
  const intakeTruncated = (intake?.meta.total ?? 0) > (intake?.meta.limit ?? 100);

  const monthly = useMemo(() => {
    const rows = intake?.data ?? [];
    const months = Array.from({ length: 12 }, (_, i) =>
      startOfMonth(subMonths(new Date(), 11 - i)),
    );
    const counts = new Map(months.map((m) => [m.getTime(), 0]));
    rows.forEach((p) => {
      const key = startOfMonth(new Date(p.createdAt)).getTime();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return months.map((m) => ({ label: format(m, "MMM"), patients: counts.get(m.getTime()) ?? 0 }));
  }, [patients]);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !doctor) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/doctors" search={{}}>
            <ArrowLeft /> Back to doctors
          </Link>
        </Button>
        <ErrorState
          title="Could not load this doctor"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const patientMeta = patients?.meta ?? {
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };

  const columns: Column<Patient>[] = [
    {
      id: "patient",
      header: "Patient",
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={row.name} src={row.avatarUrl} className="size-9" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email ?? row.phone}</p>
          </div>
        </div>
      ),
    },
    {
      id: "condition",
      header: "Condition",
      cell: (row) => <ConditionBadge condition={row.condition} />,
    },
    {
      id: "age",
      header: "Age",
      cell: (row) => <span className="tabular-nums text-sm">{row.age}</span>,
    },
    {
      id: "gender",
      header: "Gender",
      cell: (row) => <GenderBadge gender={row.gender} />,
    },
    {
      id: "added",
      header: "Added",
      cell: (row) => <RelativeDate iso={row.createdAt} />,
    },
    {
      id: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Actions for ${row.name}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link
                to="/patients"
                search={{
                  q: row.name,
                  condition: undefined,
                  doctorId: undefined,
                  gender: undefined,
                  sort: undefined,
                  page: undefined,
                  limit: undefined,
                }}
              >
                <Users /> Open in patients
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => setPendingPatientDelete(row)}
            >
              <Trash2 /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/doctors" search={{}}>
          <ArrowLeft /> All doctors
        </Link>
      </Button>

      <Card className="overflow-hidden rounded-2xl shadow-soft">
        <div className="bg-mesh h-24" />
        <CardContent className="-mt-10 pt-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <UserAvatar
                name={doctor.name}
                src={doctor.avatarUrl}
                className="size-20 rounded-2xl border-4 border-background"
              />
              <div className="pb-1">
                <h1 className="text-2xl font-semibold tracking-tight">{doctor.name}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <SpecializationBadge specialization={doctor.specialization} />
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="size-3.5" /> {doctor.hospital}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus /> Add patient
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDoctorDelete(true)}
              >
                <Trash2 /> Delete
              </Button>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Patients</dt>
              <dd className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums">
                <Users className="size-4 text-muted-foreground" /> {doctor.patientCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Latest patient
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {doctor.latestPatientAt ? (
                  <RelativeDate iso={doctor.latestPatientAt} />
                ) : (
                  <span className="text-base font-normal text-muted-foreground">
                    No patients yet
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Member since
              </dt>
              <dd className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <CalendarDays className="size-4 text-muted-foreground" />{" "}
                {format(new Date(doctor.createdAt), "MMM yyyy")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Contact</dt>
              <dd className="mt-1 space-y-0.5 text-sm">
                <a
                  href={`tel:${doctor.phone}`}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  <Phone className="size-3.5 text-muted-foreground" /> {doctor.phone}
                </a>
                <a
                  href={`mailto:${doctor.email}`}
                  className="flex min-w-0 items-center gap-1.5 hover:underline"
                >
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doctor.email}</span>
                </a>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="rounded-2xl shadow-soft">
          <CardHeader>
            <CardTitle>Patients</CardTitle>
            <CardDescription>
              {patientMeta.total} patient{patientMeta.total === 1 ? "" : "s"} assigned to{" "}
              {doctor.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterBar>
              <SearchInput
                value={search.q ?? ""}
                onChange={(v) =>
                  navigate({
                    search: (prev): DoctorProfileSearch => ({
                      ...prev,
                      q: v || undefined,
                      page: undefined,
                    }),
                    replace: true,
                  })
                }
                placeholder="Search patients…"
                ariaLabel="Search this doctor's patients"
                className="w-full lg:w-64"
              />
              <FilterSelect
                ariaLabel="Filter by condition"
                placeholder="All conditions"
                value={search.condition}
                onChange={(v) =>
                  navigate({
                    search: (prev): DoctorProfileSearch => ({
                      ...prev,
                      condition: v,
                      page: undefined,
                    }),
                    replace: true,
                  })
                }
                options={(conditionOptions?.conditions ?? []).map((c: string) => ({
                  value: c,
                  label: c,
                }))}
                className="lg:ml-auto lg:w-[200px]"
              />
            </FilterBar>

            <DataTable
              columns={columns}
              rows={patients?.data ?? []}
              getRowId={(row) => row.id}
              loading={patientsPending}
              fetching={patientsFetching}
              skeletonRows={5}
              mobileCard={(row) => (
                <div className="flex items-center gap-3">
                  <UserAvatar name={row.name} src={row.avatarUrl} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.condition} · {row.age} yrs
                    </p>
                  </div>
                </div>
              )}
              empty={
                <EmptyState
                  title={
                    search.q || search.condition ? "No patients match" : "No patients assigned yet"
                  }
                  description={
                    search.q || search.condition
                      ? "Try a different search term or clear the filter."
                      : "Add this doctor's first patient to see them here."
                  }
                  action={
                    search.q || search.condition ? (
                      <Button
                        variant="outline"
                        onClick={() =>
                          navigate({
                            search: {
                              q: undefined,
                              condition: undefined,
                              sort: undefined,
                              page: undefined,
                            },
                            replace: true,
                          })
                        }
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button onClick={() => setAddOpen(true)}>
                        <Plus /> Add patient
                      </Button>
                    )
                  }
                />
              }
              footer={
                patientMeta.total > 0 ? (
                  <Pagination
                    meta={patientMeta}
                    onPageChange={(p) =>
                      navigate({
                        search: (prev): DoctorProfileSearch => ({ ...prev, page: p }),
                        replace: true,
                      })
                    }
                  />
                ) : undefined
              }
            />
          </CardContent>
        </Card>

        <Card className="h-fit rounded-2xl shadow-soft">
          <CardHeader>
            <CardTitle>Intake per month</CardTitle>
            <CardDescription>
              {intakePending
                ? "Loading patient history…"
                : intakeTruncated
                  ? "New patients per month across this doctor's 100 most recent records."
                  : "New patients per month over the last 12 months."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {intakePending ? (
              <Skeleton className="h-[180px] w-full" />
            ) : (
              <MonthlyBars data={monthly} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sheets */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit doctor</SheetTitle>
            <SheetDescription>Update {doctor.name}&rsquo;s profile.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <DoctorForm
              defaultValues={doctor}
              hospitals={doctorFilters?.hospitals}
              submitting={saveDoctor.isPending}
              submitLabel="Save changes"
              onCancel={() => setEditOpen(false)}
              onSubmit={(v: DoctorInput) => saveDoctor.mutate(v)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Add patient</SheetTitle>
            <SheetDescription>This patient will be assigned to {doctor.name}.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <PatientForm
              submitting={addPatient.isPending}
              submitLabel="Add patient"
              doctors={doctorOptions}
              onCancel={() => setAddOpen(false)}
              onSubmit={(v: PatientInput) => addPatient.mutate({ ...v, doctorId: id })}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!pendingPatientDelete}
        onOpenChange={(open) => !open && setPendingPatientDelete(undefined)}
        title={`Remove ${pendingPatientDelete?.name ?? "this patient"}?`}
        description="The patient is deleted from the practice network. This cannot be undone."
        loading={removePatient.isPending}
        onConfirm={() => pendingPatientDelete && removePatient.mutate(pendingPatientDelete)}
      />
      <ConfirmDialog
        open={confirmDoctorDelete}
        onOpenChange={setConfirmDoctorDelete}
        title={`Delete ${doctor.name}?`}
        description={
          doctor.patientCount > 0
            ? `This permanently removes the doctor and their ${doctor.patientCount} patient${doctor.patientCount === 1 ? "" : "s"}. It cannot be undone.`
            : "This permanently removes the doctor. It cannot be undone."
        }
        loading={deleteThisDoctor.isPending}
        onConfirm={() => deleteThisDoctor.mutate()}
      />
    </div>
  );
}
