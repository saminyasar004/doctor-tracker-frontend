import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUpload } from "@/components/common/avatar-upload";
import { UserAvatar } from "@/components/common/user-avatar";
import { Combobox } from "./combobox";
import {
  CONDITIONS,
  GENDERS,
  GENDER_LABEL,
  type DoctorOption,
  type PatientInput,
} from "@/lib/types";

export const patientSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  age: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Enter a valid age")
    .refine((v) => Number(v) <= 120, "Age must be 120 or less"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { message: "Select a gender" }),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{7,20}$/, "Enter a valid phone number"),
  email: z.string().trim().max(255).email("Enter a valid email").or(z.literal("")),
  condition: z.string().trim().min(2, "Condition is required").max(60),
  notes: z.string().max(500, "Notes must be under 500 characters").optional(),
  avatarUrl: z.string().optional(),
  doctorId: z.string().min(1, "Assign a doctor"),
});
type Values = z.infer<typeof patientSchema>;

export function PatientForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel = "Save patient",
  onCancel,
  doctors,
  conditions = [],
}: {
  defaultValues?: Partial<PatientInput> | undefined;
  onSubmit: (v: PatientInput) => void;
  submitting?: boolean | undefined;
  submitLabel?: string | undefined;
  onCancel?: (() => void) | undefined;
  /** When provided, a doctor picker is shown (for reassignment). */
  doctors?: DoctorOption[] | undefined;
  /** From `GET /patients/filter-options`; the static list is the first-paint fallback. */
  conditions?: string[] | undefined;
}) {
  const conditionOptions = conditions.length > 0 ? conditions : CONDITIONS;
  const form = useForm<Values>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      age: defaultValues?.age != null ? String(defaultValues.age) : "",
      ...(defaultValues?.gender ? { gender: defaultValues.gender } : {}),
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      condition: defaultValues?.condition ?? "",
      notes: defaultValues?.notes ?? "",
      avatarUrl: defaultValues?.avatarUrl,
      doctorId: defaultValues?.doctorId ?? "",
    },
  });

  const submit = (v: Values) =>
    onSubmit({
      ...v,
      age: Number(v.age),
      email: v.email || undefined,
      notes: v.notes?.trim() || undefined,
    });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="avatarUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Photo <span className="text-muted-foreground">(optional)</span>
              </FormLabel>
              <AvatarUpload
                value={field.value}
                onChange={field.onChange}
                folder="patients"
                disabled={submitting}
              />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Emma Walker" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="age"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Age</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" placeholder="42" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email <span className="text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input type="email" placeholder="name@mail.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="condition"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Condition</FormLabel>
              <FormControl>
                <Combobox
                  allowCustom
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select or type a condition"
                  options={conditionOptions.map((c) => ({ value: c, label: c }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {doctors && (
          <FormField
            control={form.control}
            name="doctorId"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Assigned doctor</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Choose a doctor"
                    options={doctors.map((d) => ({
                      value: d.id,
                      label: d.name,
                      hint: d.specialization ?? undefined,
                      icon: <UserAvatar name={d.name} src={d.avatarUrl} className="size-5" />,
                    }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Notes <span className="text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Allergies, follow-ups, care notes…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
