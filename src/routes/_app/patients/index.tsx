import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Stethoscope,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import { DataTable, type Column } from "@/components/common/data-table";
import {
  DateRangePicker,
  FilterBar,
  FilterChips,
  FilterSelect,
  type Chip,
} from "@/components/common/filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/app-pagination";
import { SearchInput } from "@/components/common/search-input";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/common/states";
import { ConditionBadge, GenderBadge, SpecializationBadge } from "@/components/common/badges";
import { RelativeDate } from "@/components/common/misc";
import { UserAvatar } from "@/components/common/user-avatar";
import { PatientForm } from "@/components/forms/patient-form";
import { Button } from "@/components/ui/button";
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
  PATIENT_SORT_OPTIONS,
  createPatient,
  deletePatient,
  updatePatient,
  type PatientSort,
} from "@/lib/api/patients";
import {
  doctorKeys,
  dashboardKeys,
  patientFilterOptionsQuery,
  patientKeys,
  patientsQuery,
} from "@/lib/queries";
import { oneOf, posInt, str } from "@/lib/search-params";
import { GENDERS, GENDER_LABEL, type Patient, type PatientInput } from "@/lib/types";

const SORTS = PATIENT_SORT_OPTIONS.map((o) => o.value);
const EMPTY_SEARCH = {
  q: undefined,
  condition: undefined,
  doctorId: undefined,
  gender: undefined,
  from: undefined,
  to: undefined,
  sort: undefined,
  page: undefined,
  limit: undefined,
} as const;

/** Every filter lives in the URL so the view is shareable and back-button safe. */
export type PatientsSearch = {
  q?: string | undefined;
  condition?: string | undefined;
  doctorId?: string | undefined;
  gender?: (typeof GENDERS)[number] | undefined;
  from?: string | undefined;
  to?: string | undefined;
  sort?: PatientSort | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export const Route = createFileRoute("/_app/patients/")({
  validateSearch: (s: Record<string, unknown>): PatientsSearch => ({
    q: str(s["q"]),
    condition: str(s["condition"]),
    doctorId: str(s["doctorId"]),
    gender: oneOf(s["gender"], GENDERS),
    from: str(s["from"]),
    to: str(s["to"]),
    sort: oneOf(s["sort"], SORTS),
    page: posInt(s["page"]),
    limit: posInt(s["limit"]),
  }),
  head: () => ({
    meta: [
      { title: "Patients — Doctor Tracker" },
      {
        name: "description",
        content: "Every patient in the practice network, filterable by doctor.",
      },
      { property: "og:title", content: "Patients — Doctor Tracker" },
      {
        property: "og:description",
        content: "Every patient in the practice network, filterable by doctor.",
      },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Patient | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filters = {
    page: search.page,
    limit: search.limit ?? 10,
    // The URL uses the short `q`; the API's filter is called `search`.
    search: search.q,
    condition: search.condition,
    doctorId: search.doctorId,
    gender: search.gender,
    from: search.from,
    to: search.to,
    sort: search.sort,
  };

  const { data, isPending, isFetching, isError, error, refetch } = useQuery(patientsQuery(filters));
  const { data: options } = useQuery(patientFilterOptionsQuery);

  const rows = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta ?? {
    page: 1,
    limit: filters.limit,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };
  const selectedRows = rows.filter((row) => selected.has(row.id));

  const setFilters = (patch: Partial<PatientsSearch>, resetPage = true) => {
    navigate({
      search: (prev): PatientsSearch => ({
        ...prev,
        ...patch,
        ...(resetPage ? { page: undefined } : {}),
      }),
      replace: true,
    });
  };

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: patientKeys.all }),
      queryClient.invalidateQueries({ queryKey: doctorKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
  };

  const save = useMutation({
    mutationFn: async (input: PatientInput) =>
      editing ? updatePatient(editing.id, input) : createPatient(input),
    onSuccess: async (saved) => {
      toast.success(editing ? "Patient updated" : "Patient created", {
        description: `${saved.name} · ${saved.condition}`,
      });
      setFormOpen(false);
      setEditing(undefined);
      await refreshAll();
    },
    onError: (e: Error) => toast.error("Could not save the patient", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (targets: Patient[]) => {
      await Promise.all(targets.map((p) => deletePatient(p.id)));
      return targets.length;
    },
    onSuccess: async (count) => {
      toast.success(count === 1 ? "Patient deleted" : `${count} patients deleted`);
      setPendingDelete(undefined);
      setSelected(new Set());
      await refreshAll();
    },
    onError: (e: Error) => toast.error("Could not delete the patient", { description: e.message }),
  });

  const chips: Chip[] = [];
  if (search.q)
    chips.push({
      key: "q",
      label: `Search: “${search.q}”`,
      onRemove: () => setFilters({ q: undefined }),
    });
  if (search.condition) {
    chips.push({
      key: "condition",
      label: search.condition,
      onRemove: () => setFilters({ condition: undefined }),
    });
  }
  if (search.doctorId) {
    const doctorName =
      options?.doctors.find((d) => d.id === search.doctorId)?.name ?? search.doctorId;
    chips.push({
      key: "doctor",
      label: doctorName,
      onRemove: () => setFilters({ doctorId: undefined }),
    });
  }
  if (search.gender) {
    chips.push({
      key: "gender",
      label: GENDER_LABEL[search.gender],
      onRemove: () => setFilters({ gender: undefined }),
    });
  }
  if (search.from || search.to) {
    chips.push({
      key: "dates",
      label: `${search.from ?? "…"} → ${search.to ?? "…"}`,
      onRemove: () => setFilters({ from: undefined, to: undefined }),
    });
  }

  const clearAll = () => {
    navigate({ search: { ...EMPTY_SEARCH, limit: search.limit }, replace: true });
  };

  const columns: Column<Patient>[] = [
    {
      id: "patient",
      header: "Patient",
      cell: (row) => (
        <Link
          to="/patients/$id"
          params={{ id: row.id }}
          className="flex min-w-0 items-center gap-3 hover:underline"
        >
          <UserAvatar name={row.name} src={row.avatarUrl} className="size-9" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email ?? row.phone}</p>
          </div>
        </Link>
      ),
    },
    {
      id: "condition",
      header: "Condition",
      cell: (row) => <ConditionBadge condition={row.condition} />,
    },
    {
      id: "doctor",
      header: "Doctor",
      cell: (row) =>
        row.doctor ? (
          <Link
            to="/doctors/$id"
            params={{ id: row.doctor.id }}
            search={{}}
            className="flex min-w-0 items-center gap-1.5 text-sm hover:underline"
          >
            <Stethoscope className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{row.doctor.name}</span>
            <SpecializationBadge
              specialization={row.doctor.specialization}
              className="hidden xl:inline-flex"
            />
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        ),
    },
    {
      id: "age",
      header: "Age",
      cell: (row) => <span className="tabular-nums text-sm">{row.age}</span>,
    },
    { id: "gender", header: "Gender", cell: (row) => <GenderBadge gender={row.gender} /> },
    {
      id: "contact",
      header: "Phone",
      cell: (row) => (
        <a
          href={`tel:${row.phone}`}
          className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <Phone className="size-3.5 shrink-0" />
          {row.phone}
        </a>
      ),
    },
    { id: "added", header: "Added", cell: (row) => <RelativeDate iso={row.createdAt} /> },
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
              <Link to="/patients/$id" params={{ id: row.id }}>
                <Users /> Open profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/doctors/$id" params={{ id: row.doctorId }} search={{}}>
                <Stethoscope /> View doctor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setEditing(row);
                setFormOpen(true);
              }}
            >
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onSelect={() => setPendingDelete(row)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const mobileCard = (row: Patient) => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <UserAvatar name={row.name} src={row.avatarUrl} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.age} yrs · {GENDER_LABEL[row.gender]}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ConditionBadge condition={row.condition} />
        {row.doctor && (
          <Link
            to="/doctors/$id"
            params={{ id: row.doctor.id }}
            search={{}}
            className="truncate text-xs text-muted-foreground hover:underline"
          >
            {row.doctor.name}
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Patients"
        description={
          isPending
            ? "Loading patients…"
            : `${meta.total} patient${meta.total === 1 ? "" : "s"} in the network`
        }
        actions={
          <>
            {selectedRows.length > 0 && (
              <Button variant="outline" onClick={() => setPendingDelete(selectedRows[0]!)}>
                <Trash2 /> Delete {selectedRows.length} selected
              </Button>
            )}
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus /> Add patient
            </Button>
          </>
        }
      />

      <div>
        <FilterBar>
          <SearchInput
            value={search.q ?? ""}
            onChange={(v) => setFilters({ q: v || undefined })}
            placeholder="Search patients…"
            ariaLabel="Search patients"
            className="w-full lg:w-60"
          />
          <FilterSelect
            ariaLabel="Filter by doctor"
            placeholder="All doctors"
            value={filters.doctorId}
            onChange={(v) => setFilters({ doctorId: v })}
            options={(options?.doctors ?? []).map((d) => ({ value: d.id, label: d.name }))}
            className="lg:w-[170px]"
          />
          <FilterSelect
            ariaLabel="Filter by condition"
            placeholder="All conditions"
            value={filters.condition}
            onChange={(v) => setFilters({ condition: v })}
            options={(options?.conditions ?? []).map((c: string) => ({ value: c, label: c }))}
            className="lg:w-[160px]"
          />
          <FilterSelect
            ariaLabel="Filter by gender"
            placeholder="Any gender"
            value={filters.gender}
            onChange={(v) => setFilters({ gender: v as PatientsSearch["gender"] })}
            options={GENDERS.map((g) => ({ value: g, label: GENDER_LABEL[g] }))}
            className="lg:w-[130px]"
          />
          <DateRangePicker
            value={
              filters.from || filters.to
                ? {
                    from: filters.from ? new Date(filters.from) : undefined,
                    to: filters.to ? new Date(filters.to) : undefined,
                  }
                : undefined
            }
            onChange={(range: DateRange | undefined) =>
              setFilters({
                from: range?.from ? range.from.toISOString().slice(0, 10) : undefined,
                to: range?.to ? range.to.toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <FilterSelect
            ariaLabel="Sort patients"
            placeholder="Sort: newest"
            value={filters.sort}
            onChange={(v) => setFilters({ sort: v as PatientSort | undefined })}
            options={PATIENT_SORT_OPTIONS}
            className="lg:ml-auto lg:w-[165px]"
          />
        </FilterBar>
        <FilterChips chips={chips} onClearAll={clearAll} />
      </div>

      {isError ? (
        <ErrorState
          title="Could not load patients"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          loading={isPending}
          fetching={isFetching}
          selected={selected}
          onSelectedChange={setSelected}
          mobileCard={mobileCard}
          empty={
            <EmptyState
              title={chips.length ? "No patients match these filters" : "No patients yet"}
              description={
                chips.length
                  ? "Try a different search term, or clear the filters to see everyone."
                  : "Add the first patient to start tracking the caseload."
              }
              action={
                chips.length ? (
                  <Button variant="outline" onClick={clearAll}>
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setEditing(undefined);
                      setFormOpen(true);
                    }}
                  >
                    <Plus /> Add patient
                  </Button>
                )
              }
            />
          }
          footer={
            meta.total > 0 ? (
              <Pagination
                meta={meta}
                onPageChange={(p) => setFilters({ page: p }, false)}
                onLimitChange={(l) => setFilters({ limit: l }, false)}
              />
            ) : undefined
          }
        />
      )}

      <Sheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(undefined);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit patient" : "Add patient"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Update this patient's record or move them to another doctor."
                : "Create a patient and assign them to a doctor."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <PatientForm
              key={editing?.id ?? "new"}
              defaultValues={editing}
              doctors={options?.doctors}
              conditions={options?.conditions}
              submitting={save.isPending}
              submitLabel={editing ? "Save changes" : "Create patient"}
              onCancel={() => setFormOpen(false)}
              onSubmit={(v: PatientInput) => save.mutate(v)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
        title={
          selectedRows.length > 1
            ? `Delete ${selectedRows.length} patients?`
            : `Delete ${pendingDelete?.name ?? "this patient"}?`
        }
        description={
          selectedRows.length > 1
            ? "All selected patients are permanently removed from the practice network. This cannot be undone."
            : "The patient is permanently removed from the practice network. This cannot be undone."
        }
        loading={remove.isPending}
        onConfirm={() => {
          const targets =
            selectedRows.length > 1 ? selectedRows : pendingDelete ? [pendingDelete] : [];
          if (targets.length > 0) remove.mutate(targets);
        }}
      />
    </div>
  );
}
