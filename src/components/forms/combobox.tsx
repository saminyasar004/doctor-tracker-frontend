import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string | undefined;
  icon?: ReactNode;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowCustom,
  id,
  invalid,
}: {
  value?: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder: string;
  allowCustom?: boolean;
  id?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = options.find((o) => o.value === value);
  const exact = options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            invalid && "border-destructive",
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected?.icon}
            {selected?.label ?? (value || placeholder)}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>
              {allowCustom ? "Press the option below to add it." : "No results."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {o.icon}
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                  <Check
                    className={cn("size-4", value === o.value ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {allowCustom && q.trim() && !exact && (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={`__custom ${q}`}
                  onSelect={() => {
                    onChange(q.trim());
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <Plus /> Use “{q.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
