import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/data-table";
import {
  FilterBar,
  FilterChips,
  FilterSelect,
  DateRangePicker,
  type Chip,
} from "@/components/common/filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/app-pagination";
import { SearchInput } from "@/components/common/search-input";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState, EmptyState } from "@/components/common/states";
import { SpecializationBadge } from "@/components/common/badges";
import { RelativeDate } from "@/components/common/misc";
import { UserAvatar } from "@/components/common/user-avatar";
import { DoctorForm } from "@/components/forms/doctor-form";
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
  DOCTOR_SORT_OPTIONS,
  createDoctor,
  deleteDoctor,
  updateDoctor,
  type DoctorSort,
} from "@/lib/api/doctors";
import { doctorKeys, doctorFilterOptionsQuery, doctorsQuery } from "@/lib/queries";
import { oneOf, posInt, str } from "@/lib/search-params";
import type { Doctor, DoctorInput } from "@/lib/types";

const SORTS = DOCTOR_SORT_OPTIONS.map((o) => o.value);

/** Every filter lives in the URL so the view is shareable and back-button safe. */
export type DoctorsSearch = {
  q?: string | undefined;
  specialization?: string | undefined;
  hospital?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  sort?: DoctorSort | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export const Route = createFileRoute("/_app/doctors/")({
  validateSearch: (s: Record<string, unknown>): DoctorsSearch => ({
    q: str(s["q"]),
    specialization: str(s["specialization"]),
    hospital: str(s["hospital"]),
    from: str(s["from"]),
    to: str(s["to"]),
    sort: oneOf(s["sort"], SORTS),
    page: posInt(s["page"]),
    limit: posInt(s["limit"]),
  }),
  head: () => ({
    meta: [
      { title: "Doctors — Doctor Tracker" },
      {
        name: "description",
        content: "Search, filter and manage the doctors in the practice network.",
      },
      { property: "og:title", content: "Doctors — Doctor Tracker" },
      {
        property: "og:description",
        content: "Search, filter and manage the doctors in the practice network.",
      },
    ],
  }),
  component: DoctorsPage,
});

function DoctorsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Doctor | undefined>();

  const filters = {
    // The URL uses the short `q`; the API's filter is called `search`.
    search: search.q,
    specialization: search.specialization,
    hospital: search.hospital,
    from: search.from,
    to: search.to,
    sort: search.sort,
    page: search.page,
    limit: search.limit ?? 10,
  };

  const { data, isPending, isFetching, isError, error, refetch } = useQuery(doctorsQuery(filters));
  const { data: options } = useQuery(doctorFilterOptionsQuery);

  const rows = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta ?? {
    page: 1,
    limit: filters.limit,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };

  /** Merges a partial update into the URL; resets the page unless it changes paging. */
  const setFilters = (patch: Partial<typeof search>, resetPage = true) => {
    navigate({
      search: (prev): DoctorsSearch => ({
        ...prev,
        ...patch,
        ...(resetPage ? { page: undefined } : {}),
      }),
      replace: true,
    });
  };

  const save = useMutation({
    mutationFn: async (input: DoctorInput) =>
      editing ? updateDoctor(editing.id, input) : createDoctor(input),
    onSuccess: async (saved) => {
      toast.success(editing ? "Doctor updated" : "Doctor created", {
        description: `${saved.name} · ${saved.specialization}`,
      });
      setFormOpen(false);
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: doctorKeys.all });
    },
    onError: (e: Error) => toast.error("Could not save the doctor", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (doctor: Doctor) => deleteDoctor(doctor.id),
    onSuccess: async ({ deletedPatients }) => {
      toast.success("Doctor deleted", {
        description: deletedPatients
          ? `${deletedPatients} patient${deletedPatients === 1 ? "" : "s"} removed with the doctor.`
          : "The doctor had no patients.",
      });
      setPendingDelete(undefined);
      await queryClient.invalidateQueries({ queryKey: doctorKeys.all });
    },
    onError: (e: Error) => toast.error("Could not delete the doctor", { description: e.message }),
  });

  const chips: Chip[] = [];
  if (search.q)
    chips.push({
      key: "q",
      label: `Search: “${search.q}”`,
      onRemove: () => setFilters({ q: undefined }),
    });
  if (search.specialization) {
    chips.push({
      key: "spec",
      label: search.specialization,
      onRemove: () => setFilters({ specialization: undefined }),
    });
  }
  if (search.hospital) {
    chips.push({
      key: "hospital",
      label: search.hospital,
      onRemove: () => setFilters({ hospital: undefined }),
    });
  }
  if (search.from || search.to) {
    chips.push({
      key: "dates",
      label: `${search.from ?? "…"} → ${search.to ?? "…"}`,
      onRemove: () => setFilters({ from: undefined, to: undefined }),
    });
  }

  const columns: Column<Doctor>[] = [
    {
      id: "doctor",
      header: "Doctor",
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={row.name} src={row.avatarUrl} className="size-9" />
          <div className="min-w-0">
            <Link
              to="/doctors/$id"
              params={{ id: row.id }}
              className="truncate font-medium hover:underline"
            >
              {row.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "specialization",
      header: "Specialization",
      cell: (row) => <SpecializationBadge specialization={row.specialization} />,
    },
    {
      id: "hospital",
      header: "Hospital",
      cell: (row) => (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{row.hospital}</span>
        </span>
      ),
    },
    {
      id: "patients",
      header: "Patients",
      className: "text-right",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
          <UserRound className="size-3.5 text-muted-foreground" />
          {row.patientCount}
        </span>
      ),
    },
    {
      id: "phone",
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
    {
      id: "createdAt",
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
              <Link to="/doctors/$id" params={{ id: row.id }} search={{}}>
                <Stethoscope /> View profile
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

  const mobileCard = (row: Doctor) => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <UserAvatar name={row.name} src={row.avatarUrl} className="size-10" />
        <div className="min-w-0 flex-1">
          <Link
            to="/doctors/$id"
            params={{ id: row.id }}
            search={{}}
            className="block truncate font-medium"
          >
            {row.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{row.hospital}</p>
        </div>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {row.patientCount} pts
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SpecializationBadge specialization={row.specialization} />
        <span className="text-xs text-muted-foreground">{row.email}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Doctors"
        description={
          isPending
            ? "Loading the practice network…"
            : `${meta.total} doctor${meta.total === 1 ? "" : "s"} in the network`
        }
        actions={
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus /> Add doctor
          </Button>
        }
      />

      <div>
        <FilterBar>
          <SearchInput
            value={search.q ?? ""}
            onChange={(v) => setFilters({ q: v || undefined })}
            placeholder="Search name, email, hospital…"
            ariaLabel="Search doctors"
            className="w-full lg:w-72"
          />
          <FilterSelect
            ariaLabel="Filter by specialization"
            placeholder="All specializations"
            value={filters.specialization}
            onChange={(v) => setFilters({ specialization: v })}
            options={(options?.specializations ?? []).map((s: string) => ({ value: s, label: s }))}
          />
          <FilterSelect
            ariaLabel="Filter by hospital"
            placeholder="All hospitals"
            value={filters.hospital}
            onChange={(v) => setFilters({ hospital: v })}
            options={(options?.hospitals ?? []).map((h: string) => ({ value: h, label: h }))}
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
            onChange={(range) =>
              setFilters({
                from: range?.from ? range.from.toISOString().slice(0, 10) : undefined,
                to: range?.to ? range.to.toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <FilterSelect
            ariaLabel="Sort doctors"
            placeholder="Sort: newest"
            value={filters.sort}
            onChange={(v) => setFilters({ sort: v as DoctorSort | undefined })}
            options={DOCTOR_SORT_OPTIONS}
            className="lg:ml-auto lg:w-[190px]"
          />
        </FilterBar>
        <FilterChips
          chips={chips}
          onClearAll={() =>
            setFilters({
              q: undefined,
              specialization: undefined,
              hospital: undefined,
              from: undefined,
              to: undefined,
            })
          }
        />
      </div>

      {isError ? (
        <ErrorState
          title="Could not load doctors"
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
          mobileCard={mobileCard}
          empty={
            <EmptyState
              title={chips.length ? "No doctors match these filters" : "No doctors yet"}
              description={
                chips.length
                  ? "Try a different search term, or clear the filters to see everyone."
                  : "Add the first doctor to start building the practice network."
              }
              action={
                chips.length ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFilters({
                        q: undefined,
                        specialization: undefined,
                        hospital: undefined,
                        from: undefined,
                        to: undefined,
                      })
                    }
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setEditing(undefined);
                      setFormOpen(true);
                    }}
                  >
                    <Plus /> Add doctor
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
            <SheetTitle>{editing ? "Edit doctor" : "Add doctor"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Update this doctor's profile. Fields left empty keep their current value."
                : "Create a doctor in the practice network. The email must be unique."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <DoctorForm
              key={editing?.id ?? "new"}
              defaultValues={editing}
              hospitals={options?.hospitals}
              submitting={save.isPending}
              submitLabel={editing ? "Save changes" : "Create doctor"}
              onCancel={() => setFormOpen(false)}
              onSubmit={(v: DoctorInput) => save.mutate(v)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
        title={`Delete ${pendingDelete?.name ?? "this doctor"}?`}
        description={
          pendingDelete && pendingDelete.patientCount > 0
            ? `This permanently removes the doctor and their ${pendingDelete.patientCount} patient${pendingDelete.patientCount === 1 ? "" : "s"}. It cannot be undone.`
            : "This permanently removes the doctor. It cannot be undone."
        }
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </div>
  );
}
