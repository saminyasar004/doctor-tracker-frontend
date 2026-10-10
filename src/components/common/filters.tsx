import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-2 shadow-soft lg:flex-row lg:flex-wrap lg:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function FilterChips({
  chips,
  onClearAll,
}: {
  chips: Chip[];
  onClearAll?: (() => void) | undefined;
}) {
  if (!chips.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <AnimatePresence initial={false}>
        {chips.map((c) => (
          <motion.span
            key={c.key}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1 rounded-full border bg-accent/60 py-1 pl-3 pr-1 text-xs font-medium"
          >
            {c.label}
            <button
              type="button"
              aria-label={`Remove filter ${c.label}`}
              onClick={c.onRemove}
              className="grid size-5 place-items-center rounded-full hover:bg-background"
            >
              <X className="size-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

export const ALL = "__all__";

export function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
  ariaLabel,
}: {
  value?: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string | undefined;
  ariaLabel?: string | undefined;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger
        aria-label={ariaLabel ?? placeholder}
        className={cn("h-9 w-full rounded-lg lg:w-[170px]", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Created date",
  className,
}: {
  value?: DateRange | undefined;
  onChange: (v: DateRange | undefined) => void;
  placeholder?: string;
  className?: string | undefined;
}) {
  const label = value?.from
    ? value.to
      ? `${format(value.from, "MMM d")} – ${format(value.to, "MMM d, yyyy")}`
      : format(value.from, "MMM d, yyyy")
    : placeholder;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-full justify-start rounded-lg font-normal lg:w-auto",
            !value?.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={value}
          onSelect={onChange}
          {...(value?.from ? { defaultMonth: value.from } : {})}
        />
        {value?.from && (
          <div className="border-t p-2 text-right">
            <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
              Reset
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
