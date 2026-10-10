import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Loader2, Stethoscope, Users } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/common/user-avatar";
import { useDebounce } from "@/hooks/use-debounce";
import { globalSearch, type SearchResult } from "@/lib/api/dashboard";

export type PaletteTarget =
  | { kind: "page"; path: "/dashboard" | "/doctors" | "/patients" }
  | { kind: "result"; result: SearchResult };

const PAGES = [
  { path: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { path: "/doctors" as const, label: "Doctors", icon: Stethoscope },
  { path: "/patients" as const, label: "Patients", icon: Users },
];

export function CommandPalette({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (t: PaletteTarget) => void;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 200);
  const { data = [], isFetching } = useQuery({
    queryKey: ["search", dq],
    queryFn: () => globalSearch(dq),
    enabled: open && !!dq.trim(),
    placeholderData: keepPreviousData,
  });
  const pick = (t: PaletteTarget) => {
    onSelect(t);
    onOpenChange(false);
    setQ("");
  };
  const results = dq.trim() ? data : [];
  const doctors = results.filter((r) => r.type === "doctor");
  const patients = results.filter((r) => r.type === "patient");
  const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden rounded-2xl p-0 sm:max-w-xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command shouldFilter={false} className="[&_[cmdk-input-wrapper]]:h-12">
          <div className="relative">
            <CommandInput
              value={q}
              onValueChange={setQ}
              placeholder="Search doctors, patients, pages…"
            />
            {isFetching && (
              <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>{dq.trim() ? "No matches found." : "Type to search."}</CommandEmpty>
            {pages.length > 0 && (
              <CommandGroup heading="Pages">
                {pages.map((p) => (
                  <CommandItem
                    key={p.path}
                    value={p.path}
                    onSelect={() => pick({ kind: "page", path: p.path })}
                  >
                    <p.icon /> {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {[
              { h: "Doctors", items: doctors },
              { h: "Patients", items: patients },
            ].map(
              (g) =>
                g.items.length > 0 && (
                  <CommandGroup key={g.h} heading={g.h}>
                    {g.items.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={r.id}
                        onSelect={() => pick({ kind: "result", result: r })}
                      >
                        <UserAvatar name={r.title} src={r.avatarUrl} className="size-7" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ),
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
