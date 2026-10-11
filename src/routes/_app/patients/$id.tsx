import { useState } from "react";
import { Link, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Cake,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/states";
import { ConditionBadge, GenderBadge } from "@/components/common/badges";
import { RelativeDate } from "@/components/common/misc";
import { UserAvatar } from "@/components/common/user-avatar";
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
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deletePatient, updatePatient } from "@/lib/api/patients";
import {
  doctorKeys,
  doctorOptionsQuery,
  patientFilterOptionsQuery,
  patientKeys,
  patientQuery,
} from "@/lib/queries";
import type { PatientInput } from "@/lib/types";

export const Route = createFileRoute("/_app/patients/$id")({
  head: () => ({
    meta: [
      { title: "Patient profile — Doctor Tracker" },
      { name: "description", content: "Record, contact details and care history of one patient." },
      { property: "og:title", content: "Patient profile — Doctor Tracker" },
      {
        property: "og:description",
        content: "Record, contact details and care history of one patient.",
      },
    ],
  }),
  component: PatientProfilePage,
});

function PatientProfilePage() {
  const { id } = useParams({ from: "/_app/patients/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: patient, isPending, isError, error, refetch } = useQuery(patientQuery(id));
  const { data: options } = useQuery(patientFilterOptionsQuery);
  const { data: doctorOptions } = useQuery(doctorOptionsQuery);

  const save = useMutation({
    mutationFn: (v: PatientInput) => updatePatient(id, v),
    onSuccess: (updated) => {
      queryClient.setQueryData(patientKeys.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: doctorKeys.all });
      setEditOpen(false);
      toast.success("Patient updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deletePatient(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientKeys.all });
      void queryClient.invalidateQueries({ queryKey: doctorKeys.all });
      toast.success("Patient removed");
      void navigate({ to: "/patients", search: {} });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-1" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <ErrorState
        title="Could not load this patient"
        message={error instanceof Error ? error.message : "The request failed."}
        onRetry={() => void refetch()}
      />
    );
  }

  const doctor = patient.doctor;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/patients" search={{}}>
          <ArrowLeft /> Back to patients
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar name={patient.name} src={patient.avatarUrl} className="size-16" />
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {patient.name}
              <GenderBadge gender={patient.gender} />
            </h1>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
              <ConditionBadge condition={patient.condition} />
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Cake className="size-3.5" />
                {patient.age} years
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 /> Delete patient
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>How this patient can be reached.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Phone</Label>
              <p className="flex items-center gap-2 text-sm">
                <Phone className="text-muted-foreground size-4" />
                <a className="hover:underline" href={`tel:${patient.phone}`}>
                  {patient.phone}
                </a>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Email</Label>
              {patient.email ? (
                <p className="flex items-center gap-2 text-sm">
                  <Mail className="text-muted-foreground size-4" />
                  <a className="hover:underline" href={`mailto:${patient.email}`}>
                    {patient.email}
                  </a>
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">Not provided</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Care</CardTitle>
            <CardDescription>Assignment and clinical notes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Assigned doctor</Label>
              {doctor ? (
                <p className="flex items-center gap-2 text-sm">
                  <Stethoscope className="text-muted-foreground size-4" />
                  <Link
                    to="/doctors/$id"
                    params={{ id: doctor.id }}
                    search={{}}
                    className="hover:underline"
                  >
                    {doctor.name}
                  </Link>
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">Unassigned</p>
              )}
              {doctor?.specialization && (
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Building2 className="size-3.5" />
                  {doctor.specialization}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Notes</Label>
              {patient.notes ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{patient.notes}</p>
              ) : (
                <p className="text-muted-foreground text-sm">No notes recorded</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record</CardTitle>
            <CardDescription>When this entry was created and updated.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Created</Label>
              <p className="text-sm">
                <RelativeDate iso={patient.createdAt} />
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Last updated</Label>
              <p className="text-sm">
                <RelativeDate iso={patient.updatedAt} />
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit patient</SheetTitle>
            <SheetDescription>Update the record for {patient.name}.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <PatientForm
              key={patient.id}
              defaultValues={patient}
              doctors={options?.doctors ?? doctorOptions}
              conditions={options?.conditions}
              submitting={save.isPending}
              submitLabel="Save changes"
              onCancel={() => setEditOpen(false)}
              onSubmit={(v: PatientInput) => save.mutate(v)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this patient?"
        description={`${patient.name} will be removed from the system. This cannot be undone.`}
        confirmLabel="Delete patient"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
