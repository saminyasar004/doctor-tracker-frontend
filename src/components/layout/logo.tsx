import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground glow">
        <Activity className="size-4.5" strokeWidth={2.5} />
      </div>
      {!collapsed && (
        <span className="truncate text-[15px] font-semibold tracking-tight">Doctor Tracker</span>
      )}
    </div>
  );
}
