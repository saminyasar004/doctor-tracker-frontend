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
import { AvatarUpload } from "@/components/common/avatar-upload";
import { Combobox } from "@/components/forms/combobox";
import { SPECIALIZATIONS, type DoctorInput } from "@/lib/types";

export const doctorSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  specialization: z.string().min(1, "Select a specialization"),
  hospital: z.string().trim().min(2, "Hospital is required").max(120, "Hospital name is too long"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{7,20}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").max(255),
  avatarUrl: z.string().optional(),
});
export type DoctorFormValues = z.infer<typeof doctorSchema>;

export function DoctorForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel = "Save doctor",
  onCancel,
  hospitals = [],
  specializations = [],
}: {
  defaultValues?: Partial<DoctorInput> | undefined;
  onSubmit: (v: DoctorInput) => void;
  submitting?: boolean | undefined;
  submitLabel?: string | undefined;
  onCancel?: (() => void) | undefined;
  hospitals?: string[] | undefined;
  /**
   * From `GET /doctors/filter-options`; the static list is kept as a fallback so the
   * picker is never empty while the query is in flight.
   */
  specializations?: string[] | undefined;
}) {
  const specializationOptions = specializations.length > 0 ? specializations : SPECIALIZATIONS;
  const form = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      name: "",
      specialization: "",
      hospital: "",
      phone: "",
      email: "",
      avatarUrl: undefined,
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => onSubmit(v))} className="space-y-4" noValidate>
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
                folder="doctors"
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
                <Input placeholder="Amelia Chen" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="specialization"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Specialization</FormLabel>
                <FormControl>
                  <Combobox
                    allowCustom
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select or type a specialization"
                    options={specializationOptions.map((s) => ({ value: s, label: s }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hospital"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hospital</FormLabel>
                <FormControl>
                  <Input list="hospital-list" placeholder="Mercy Valley Hospital" {...field} />
                </FormControl>
                <datalist id="hospital-list">
                  {hospitals.map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
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
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="name@hospital.health" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
